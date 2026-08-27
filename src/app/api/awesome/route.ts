import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { listAwesomeProjects } from '@/modules/candidate'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const fingerprint = new URL(request.url).searchParams.get('fingerprint') || undefined
    const actor = await resolveActorWithFingerprint(fingerprint)
    const projects = await listAwesomeProjects(actor)
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('GET /api/awesome error:', error)
    return NextResponse.json({ error: 'ERR_AWESOME_UNAVAILABLE' }, { status: 500 })
  }
}
