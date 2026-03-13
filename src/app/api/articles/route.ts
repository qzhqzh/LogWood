import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ArticleStatus } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createArticle, listAllArticlesForManage, listArticles } from '@/modules/article'

const createArticleSchema = z.object({
  title: z.string().min(3).max(120),
  columnId: z.string().min(1).optional(),
  excerpt: z.string().max(240).optional(),
  content: z.string().min(20).max(50000),
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const manage = searchParams.get('manage') === 'true'

    if (manage) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'ERR_UNAUTHORIZED' },
          { status: 401 }
        )
      }

      const all = await listAllArticlesForManage()
      return NextResponse.json({ articles: all })
    }

    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '12')
    const search = searchParams.get('search') || undefined

    const result = await listArticles({
      page,
      pageSize,
      search,
      status: ArticleStatus.published,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/articles error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ERR_UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validated = createArticleSchema.parse(body)

    const result = await createArticle(validated, session.user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_ARTICLE_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    console.error('POST /api/articles error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
