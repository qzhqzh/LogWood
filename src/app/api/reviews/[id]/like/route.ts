import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { toggleReviewLike, getReviewLikeStats, getReviewLikeList } from '@/modules/like'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const actor = await resolveActorWithFingerprint(body.deviceFingerprint)

    const result = await toggleReviewLike(id, actor)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ERR_RATE_LIMIT_EXCEEDED') {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        )
      }
      if (error.message === 'ERR_LIKE_TARGET_NOT_FOUND') {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }

    console.error('POST /api/reviews/[id]/like error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeList = searchParams.get('list') === 'true'

    const stats = await getReviewLikeStats(id)

    if (includeList) {
      const list = await getReviewLikeList(id, 50)
      return NextResponse.json({ stats, list })
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('GET /api/reviews/[id]/like error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
