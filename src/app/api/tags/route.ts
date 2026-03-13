import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createTag, listTags, TAG_SENTIMENTS } from '@/modules/tag'

const createTagSchema = z.object({
  name: z.string().min(1).max(30),
  sentiment: z.enum(TAG_SENTIMENTS),
})

export async function GET(request: NextRequest) {
  try {
    const tags = await listTags()
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('GET /api/tags error:', error)
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
    const validated = createTagSchema.parse(body)
    const tag = await createTag(validated)

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_TAG_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'ERR_TAG_NAME_REQUIRED') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('POST /api/tags error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
