import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { createComment, getComments } from '@/modules/comment'
import { z } from 'zod'

const createCommentSchema = z.object({
  reviewId: z.string(),
  content: z.string().min(10).max(500),
  language: z.string().optional(),
  deviceFingerprint: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reviewId = searchParams.get('reviewId')

    if (!reviewId) {
      return NextResponse.json(
        { error: 'ERR_REVIEW_ID_REQUIRED' },
        { status: 400 }
      )
    }

    const actor = await resolveActorWithFingerprint(
      searchParams.get('fingerprint') || undefined
    )

    const result = await getComments(
      {
        reviewId,
        page: parseInt(searchParams.get('page') || '1'),
        pageSize: parseInt(searchParams.get('pageSize') || '20'),
      },
      actor
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/comments error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createCommentSchema.parse(body)

    const actor = await resolveActorWithFingerprint(validated.deviceFingerprint)

    const result = await createComment(
      {
        reviewId: validated.reviewId,
        content: validated.content,
        language: validated.language,
      },
      actor
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_COMMENT_VALIDATION', details: error.errors },
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
      if (error.message === 'ERR_REVIEW_NOT_FOUND') {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }

    console.error('POST /api/comments error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
