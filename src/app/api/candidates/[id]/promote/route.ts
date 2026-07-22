import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TargetType } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { promoteCandidate } from '@/modules/candidate'

export const dynamic = 'force-dynamic'

const promoteSchema = z.object({
  to: z.enum(['tool', 'gallery']),
  targetType: z.nativeEnum(TargetType).optional(),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const { id } = await context.params
    const body = promoteSchema.parse(await request.json())
    const result = await promoteCandidate({
      id,
      to: body.to,
      targetType: body.targetType,
    })

    revalidatePath('/candidates')
    revalidatePath('/tools')
    revalidatePath('/app')
    revalidatePath(`/candidates/${result.candidate.slug}`)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_CANDIDATE_VALIDATION', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error) {
      if (
        error.message === 'ERR_CANDIDATE_NOT_FOUND' ||
        error.message === 'ERR_CANDIDATE_ALREADY_PROMOTED'
      ) {
        return NextResponse.json({ error: error.message }, { status: error.message === 'ERR_CANDIDATE_NOT_FOUND' ? 404 : 409 })
      }
    }
    console.error('POST /api/candidates/[id]/promote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
