import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createArticleColumn, listArticleColumns } from '@/modules/article-column'

const createSchema = z.object({
  name: z.string().min(1).max(40),
})

export async function GET(_request: NextRequest) {
  try {
    const columns = await listArticleColumns()
    return NextResponse.json({ columns })
  } catch (error) {
    console.error('GET /api/article-columns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createSchema.parse(body)
    const column = await createArticleColumn(validated)

    return NextResponse.json(column, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_COLUMN_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'ERR_COLUMN_NAME_REQUIRED') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('POST /api/article-columns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
