import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { withApiError } from '@/lib/api-handlers'
import { isAdminSession } from '@/lib/authz'
import { getScientificCoverCandidateAsset } from '@/modules/scientific-cover'

export const dynamic = 'force-dynamic'

export const GET = withApiError(
  'scientific-covers.candidates.asset',
  async (
    _request: NextRequest,
    { params }: { params: { runId: string; candidateId: string } },
  ) => {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error('ERR_UNAUTHORIZED')
    if (!isAdminSession(session)) throw new Error('ERR_FORBIDDEN')

    const asset = await getScientificCoverCandidateAsset(
      session.user.id,
      params.runId,
      params.candidateId,
    )
    return new Response(asset.data, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': asset.mimeType,
        'Content-Disposition': `inline; filename="${params.candidateId}.${asset.mimeType.split('/')[1]}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  },
)
