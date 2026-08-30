import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TargetType } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import {
  createIdempotentForgeDraft,
  forgeErrorDetails,
} from '@/modules/forge'

export const dynamic = 'force-dynamic'

const forgeDraftSchema = z.object({
  kind: z.enum(['article', 'skill']),
  prompt: z.string().min(8).max(4000),
  title: z.string().min(2).max(120).optional(),
  category: z.enum(['frontend', 'style', 'image', 'workflow', 'copy', 'other']).optional(),
  /** Backward compatibility for clients deployed before independent Skill drafts. */
  type: z.nativeEnum(TargetType).optional(),
  sourceUrl: z.string().url().optional(),
  sourceCandidateId: z.string().min(1).optional(),
  mode: z.enum(['ai', 'local']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const body = await request.json()
    const validated = forgeDraftSchema.parse(body)
    const idempotencyKey = request.headers.get('idempotency-key') || undefined
    const result = await createIdempotentForgeDraft(
      validated,
      session.user.id,
      idempotencyKey,
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_FORGE_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    const details = forgeErrorDetails(error)
    if (details.code !== 'ERR_FORGE_FAILED') {
      const status = details.code === 'ERR_FORGE_IN_PROGRESS'
        ? 409
        : details.code === 'ERR_FORGE_AI_AUTH'
          ? 502
          : details.retryable
            ? 503
            : 400
      return NextResponse.json(
        { error: details.code, retryable: details.retryable },
        { status },
      )
    }

    console.error('POST /api/forge/draft error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
