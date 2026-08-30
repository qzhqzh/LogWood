import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { withApiError } from '@/lib/api-handlers'
import { isAdminSession } from '@/lib/authz'
import { getScientificCoverRun } from '@/modules/scientific-cover'

export const dynamic = 'force-dynamic'

export const GET = withApiError(
  'scientific-covers.runs.get',
  async (_request: NextRequest, { params }: { params: { runId: string } }) => {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error('ERR_UNAUTHORIZED')
    if (!isAdminSession(session)) throw new Error('ERR_FORBIDDEN')

    const run = await getScientificCoverRun(session.user.id, params.runId)
    return NextResponse.json(run, { headers: { 'Cache-Control': 'no-store' } })
  },
)
