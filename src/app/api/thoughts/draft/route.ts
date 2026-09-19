import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { createIdempotentForgeDraft, forgeErrorDetails } from '@/modules/forge'
import { buildThoughtDraftInput, getThoughtSession } from '@/modules/thought'

export const dynamic = 'force-dynamic'

const draftSchema = z.object({
  sessionId: z.string().min(1),
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

    const { sessionId } = draftSchema.parse(await request.json())
    const draftInput = await buildThoughtDraftInput(sessionId, session.user.id)
    const result = await createIdempotentForgeDraft({
      kind: 'article',
      mode: 'ai',
      ...draftInput,
    }, session.user.id, request.headers.get('idempotency-key') || undefined)
    const refreshed = await getThoughtSession(sessionId, session.user.id)

    revalidatePath('/articles')
    revalidatePath('/articles/manage')
    revalidatePath('/forge')
    return NextResponse.json({ result, session: refreshed }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_THOUGHT_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (
      error instanceof Error
      && ['ERR_THOUGHT_SESSION_NOT_FOUND', 'ERR_FORGE_ARTICLE_NOT_FOUND'].includes(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'ERR_THOUGHT_SESSION_EMPTY') {
      return NextResponse.json({ error: error.message }, { status: 409 })
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
      return NextResponse.json(details, { status })
    }
    console.error('POST /api/thoughts/draft error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
