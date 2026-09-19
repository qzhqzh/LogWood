import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { SkillHubError } from '@/modules/agent-skill-hub/bundle'
import { createHubToken, listHubTokens, revokeHubToken } from '@/modules/agent-skill-hub/service'

export const dynamic = 'force-dynamic'

async function signedInUser() {
  const session = await getServerSession(authOptions)
  return session?.user?.id || null
}

function fail(error: unknown) {
  if (error instanceof SkillHubError) {
    return NextResponse.json({ error: error.code }, { status: error.status })
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'ERR_SKILL_HUB_VALIDATION' }, { status: 400 })
  }
  console.error('Skill Hub token management failed:', error)
  return NextResponse.json({ error: 'ERR_SKILL_HUB_UNAVAILABLE' }, { status: 500 })
}

export async function GET() {
  const userId = await signedInUser()
  if (!userId) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  try {
    return NextResponse.json({ tokens: await listHubTokens(userId) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) { return fail(error) }
}

export async function POST(request: Request) {
  const userId = await signedInUser()
  if (!userId) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  try {
    const { label } = z.object({ label: z.string().trim().min(1).max(64) }).parse(await request.json())
    return NextResponse.json(await createHubToken(userId, label), {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) { return fail(error) }
}

export async function DELETE(request: Request) {
  const userId = await signedInUser()
  if (!userId) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  try {
    const { id } = z.object({ id: z.string().min(1).max(80) }).parse(await request.json())
    await revokeHubToken(userId, id)
    return NextResponse.json({ ok: true }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) { return fail(error) }
}
