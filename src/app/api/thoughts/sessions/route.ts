import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { appendThoughtMessage, listThoughtSessions } from '@/modules/thought'

export const dynamic = 'force-dynamic'

const appendSchema = z.object({
  sessionId: z.string().min(1).optional(),
  requestId: z.string().regex(/^[a-z0-9][a-z0-9._:-]{7,179}$/i),
  content: z.string().trim().min(2).max(4000),
  action: z.enum(['chat', 'record']),
})

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'ERR_UNAUTHORIZED' as const, status: 401 }
  if (!isAdminSession(session)) return { error: 'ERR_FORBIDDEN' as const, status: 403 }
  return { userId: session.user.id }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const sessions = await listThoughtSessions(auth.userId)
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('GET /api/thoughts/sessions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const input = appendSchema.parse(await request.json())
    const result = await appendThoughtMessage(input, auth.userId)
    if (result.error) {
      const status = result.error === 'ERR_THOUGHT_AI_AUTH'
        ? 502
        : result.error === 'ERR_THOUGHT_AI_NOT_CONFIGURED'
          ? 400
          : 503
      return NextResponse.json({ ...result, saved: true }, { status })
    }
    return NextResponse.json(result, { status: input.sessionId ? 200 : 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_THOUGHT_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'ERR_THOUGHT_SESSION_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (
      error instanceof Error
      && ['ERR_THOUGHT_SESSION_FULL', 'ERR_THOUGHT_SESSION_CORRUPT'].includes(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('POST /api/thoughts/sessions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
