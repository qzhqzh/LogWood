import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { getThoughtSession } from '@/modules/thought'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }
    return NextResponse.json({
      session: await getThoughtSession(params.id, session.user.id),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ERR_THOUGHT_SESSION_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'ERR_THOUGHT_SESSION_CORRUPT') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('GET /api/thoughts/sessions/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
