import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { getAiRuntimeStatus } from '@/modules/ai-runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  }
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
  }
  try {
    return NextResponse.json(await getAiRuntimeStatus(session.user.id))
  } catch (error) {
    console.error('GET /api/ai/status error:', error)
    return NextResponse.json(
      {
        error: 'ERR_AI_STATUS_UNAVAILABLE',
        capabilities: [],
        retryable: true,
      },
      { status: 503 },
    )
  }
}
