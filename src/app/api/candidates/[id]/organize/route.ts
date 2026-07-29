import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { CandidateStatus } from '@prisma/client'
import * as z from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import {
  getCandidateById,
  organizeCandidate,
} from '@/modules/candidate'

export const dynamic = 'force-dynamic'

const organizeSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  status: z.enum([
    CandidateStatus.watching,
    CandidateStatus.evaluating,
    CandidateStatus.dropped,
  ]).optional(),
}).refine((value) => value.tags !== undefined || value.status !== undefined, {
  message: '至少提交一项修改',
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const existing = await getCandidateById(id)
    if (!existing) {
      return NextResponse.json({ error: 'ERR_CANDIDATE_NOT_FOUND' }, { status: 404 })
    }
    if (!isAdminSession(session) && existing.authorUserId !== session.user.id) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const validated = organizeSchema.parse(await request.json())
    const candidate = await organizeCandidate({
      id,
      ...(validated.tags
        ? { tags: Array.from(new Set(validated.tags.map((tag) => tag.trim()))) }
        : {}),
      ...(validated.status ? { status: validated.status } : {}),
    })

    revalidatePath('/candidates')
    revalidatePath(`/candidates/${candidate.slug}`)
    return NextResponse.json({ candidate })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_CANDIDATE_ORGANIZE_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (
      error instanceof Error
      && (
        error.message === 'ERR_CANDIDATE_NOT_FOUND'
        || error.message === 'ERR_CANDIDATE_ALREADY_PROMOTED'
      )
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === 'ERR_CANDIDATE_NOT_FOUND' ? 404 : 409 },
      )
    }
    return NextResponse.json({ error: 'ERR_CANDIDATE_ORGANIZE_FAILED' }, { status: 500 })
  }
}
