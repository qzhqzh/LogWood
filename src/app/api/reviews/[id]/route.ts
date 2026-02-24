import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { getReviewById, getReviewStats } from '@/modules/review'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('stats') === 'true'

    const actor = await resolveActorWithFingerprint(
      searchParams.get('fingerprint') || undefined
    )

    const review = await getReviewById(id, actor)

    if (!review) {
      return NextResponse.json(
        { error: 'ERR_REVIEW_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (includeStats) {
      const stats = await getReviewStats(review.targetId)
      return NextResponse.json({ review, stats })
    }

    return NextResponse.json({ review })
  } catch (error) {
    console.error('GET /api/reviews/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
