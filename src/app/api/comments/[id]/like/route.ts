import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { toggleCommentLike } from '@/modules/like'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const actor = await resolveActorWithFingerprint(body.deviceFingerprint)

    const result = await toggleCommentLike(id, actor)

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

    console.error('POST /api/comments/[id]/like error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
