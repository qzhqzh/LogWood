import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { createReview, getReviews } from '@/modules/review'
import { z } from 'zod'

const createReviewSchema = z.object({
  targetId: z.string(),
  category: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(50).max(2000),
  language: z.string().optional(),
  deviceFingerprint: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = {
      sort: searchParams.get('sort') as 'latest' | 'hot' | undefined,
      category: searchParams.get('category') || undefined,
      targetId: searchParams.get('targetId') || undefined,
      language: searchParams.get('language') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    }

    const actor = await resolveActorWithFingerprint(
      searchParams.get('fingerprint') || undefined
    )

    const result = await getReviews(query, actor)

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/reviews error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createReviewSchema.parse(body)

    const actor = await resolveActorWithFingerprint(validated.deviceFingerprint)

    const result = await createReview(
      {
        targetId: validated.targetId,
        category: validated.category,
        rating: validated.rating,
        content: validated.content,
        language: validated.language,
      },
      actor
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_REVIEW_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'ERR_RATE_LIMIT_EXCEEDED') {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        )
      }
      if (error.message === 'ERR_TARGET_NOT_FOUND') {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }

    console.error('POST /api/reviews error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
