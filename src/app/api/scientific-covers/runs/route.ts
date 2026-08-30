import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { withApiError } from '@/lib/api-handlers'
import { isAdminSession } from '@/lib/authz'
import { createScientificCoverRun } from '@/modules/scientific-cover'

export const dynamic = 'force-dynamic'

export const POST = withApiError('scientific-covers.runs.create', async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('ERR_UNAUTHORIZED')
  if (!isAdminSession(session)) throw new Error('ERR_FORBIDDEN')

  const run = await createScientificCoverRun(await request.json(), session.user.id)
  return NextResponse.json(run, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  })
}, {
  errorStatusOverrides: {
    ERR_SCIENTIFIC_COVER_JOURNAL_REQUIRED: 400,
    ERR_SCIENTIFIC_COVER_GUIDELINES_REQUIRED: 400,
    ERR_SCIENTIFIC_COVER_STORAGE_INVALID: 500,
  },
})
