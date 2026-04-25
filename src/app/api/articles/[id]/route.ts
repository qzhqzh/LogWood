import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ArticleStatus } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { deleteArticle, getArticleByIdForManage, updateArticle } from '@/modules/article'
import { isAdminSession } from '@/lib/authz'

const updateSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  columnId: z.string().min(1).optional(),
  excerpt: z.string().max(200).optional(),
  content: z.string().min(20).max(50000).optional(),
  tags: z.array(z.string().min(1).max(30)).optional(),
  coverImageUrl: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const normalized = value.trim()
      return normalized === '' ? undefined : normalized
    },
    z.string().url().optional()
  ),
  status: z.nativeEnum(ArticleStatus).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const article = await getArticleByIdForManage(params.id)
    if (!article) {
      return NextResponse.json({ error: 'ERR_ARTICLE_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json(article)
  } catch (error) {
    console.error('GET /api/articles/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const body = await request.json()
    const validated = updateSchema.parse(body)

    const result = await updateArticle(params.id, validated)
    if (!result) {
      return NextResponse.json({ error: 'ERR_ARTICLE_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_ARTICLE_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    console.error('PATCH /api/articles/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const result = await deleteArticle(params.id)
    if (!result) {
      return NextResponse.json({ error: 'ERR_ARTICLE_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('DELETE /api/articles/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
