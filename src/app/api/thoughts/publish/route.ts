import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { recordAdminAction } from '@/modules/audit'
import { approveAndPublishArticle } from '@/modules/article'
import { getThoughtSession } from '@/modules/thought'

export const dynamic = 'force-dynamic'

const publishSchema = z.object({
  sessionId: z.string().min(1),
  articleId: z.string().min(1),
  expectedVersion: z.number().int().min(1),
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

    const input = publishSchema.parse(await request.json())
    const thought = await getThoughtSession(input.sessionId, session.user.id)
    if (thought.article?.id !== input.articleId) {
      return NextResponse.json({ error: 'ERR_THOUGHT_ARTICLE_NOT_FOUND' }, { status: 404 })
    }

    const article = await approveAndPublishArticle({
      id: input.articleId,
      reviewerUserId: session.user.id,
      authorUserId: session.user.id,
      expectedVersion: input.expectedVersion,
    })
    if (!article) {
      return NextResponse.json({ error: 'ERR_ARTICLE_NOT_FOUND' }, { status: 404 })
    }
    await recordAdminAction({
      actorUserId: session.user.id,
      action: 'thought.article.approve_publish',
      targetType: 'article',
      targetId: article.id,
      metadata: { version: article.currentVersion, sessionId: input.sessionId },
    })

    revalidatePath('/articles')
    revalidatePath('/articles/manage')
    revalidatePath(`/articles/${article.slug}`)
    revalidatePath('/forge')
    revalidatePath('/')
    return NextResponse.json({
      article,
      session: await getThoughtSession(input.sessionId, session.user.id),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_THOUGHT_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (
      error instanceof Error
      && ['ERR_THOUGHT_SESSION_NOT_FOUND', 'ERR_ARTICLE_NOT_FOUND'].includes(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (
      error instanceof Error
      && ['ERR_ARTICLE_VERSION_STALE', 'ERR_ARTICLE_ARCHIVED'].includes(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('POST /api/thoughts/publish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
