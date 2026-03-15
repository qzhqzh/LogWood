import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { createArticleComment, getArticleComments } from '@/modules/article'

const createArticleCommentSchema = z.object({
  content: z.string().min(1).max(500),
  language: z.string().optional(),
  deviceFingerprint: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)

    const result = await getArticleComments({
      articleId: id,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/articles/[id]/comments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validated = createArticleCommentSchema.parse(body)

    const actor = await resolveActorWithFingerprint(validated.deviceFingerprint)

    const result = await createArticleComment(
      {
        articleId: id,
        content: validated.content,
        language: validated.language,
      },
      actor
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_ARTICLE_COMMENT_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'ERR_RATE_LIMIT_EXCEEDED') {
        return NextResponse.json({ error: error.message }, { status: 429 })
      }
      if (error.message === 'ERR_ARTICLE_NOT_FOUND') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'ERR_ARTICLE_COMMENT_VALIDATION') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    console.error('POST /api/articles/[id]/comments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
