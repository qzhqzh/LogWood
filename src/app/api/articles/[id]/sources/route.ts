import { ArticleSourceKind } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { recordAdminAction } from '@/modules/audit'
import { addArticleSource } from '@/modules/article'

const schema = z.object({
  kind: z.nativeEnum(ArticleSourceKind),
  label: z.string().trim().min(1).max(160),
  sourceUrl: z.string().url(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    if (!isAdminSession(session)) return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    const result = await addArticleSource(params.id, schema.parse(await request.json()))
    if (result.created) {
      await recordAdminAction({
        actorUserId: session.user.id,
        action: 'article.source.add',
        targetType: 'article',
        targetId: params.id,
        metadata: { sourceId: result.source.id, kind: result.source.kind },
      })
    }
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_ARTICLE_SOURCE_INVALID', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ERR_ARTICLE_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'ERR_ARTICLE_SOURCE_INVALID') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('POST /api/articles/:id/sources error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
