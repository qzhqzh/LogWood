import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TargetType } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { createForgeDraft } from '@/modules/forge'

export const dynamic = 'force-dynamic'

const forgeDraftSchema = z.object({
  kind: z.enum(['article', 'skill']),
  prompt: z.string().min(8).max(4000),
  title: z.string().min(2).max(120).optional(),
  category: z.enum(['frontend', 'style', 'image', 'workflow', 'copy', 'other']).optional(),
  /** Backward compatibility for clients deployed before independent Skill drafts. */
  type: z.nativeEnum(TargetType).optional(),
  sourceUrl: z.string().url().optional(),
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
    const result = await createForgeDraft(validated, session.user.id)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_FORGE_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'ERR_FORGE_PROMPT_TOO_SHORT') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('POST /api/forge/draft error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
