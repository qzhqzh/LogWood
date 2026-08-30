import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { listAwesomeSkills } from '@/modules/candidate'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const fingerprint = new URL(request.url).searchParams.get('fingerprint') || undefined
    const actor = await resolveActorWithFingerprint(fingerprint)
    const skills = await listAwesomeSkills(actor)
    return NextResponse.json({ skills })
  } catch (error) {
    console.error('GET /api/awesome/skills error:', error)
    return NextResponse.json({ error: 'ERR_AWESOME_UNAVAILABLE' }, { status: 500 })
  }
}
