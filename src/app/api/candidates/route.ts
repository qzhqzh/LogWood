import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { CandidateStatus } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { assertNoEvaluationsForSubject } from '@/modules/evaluation'
import {
  createCandidate,
  deleteCandidate,
  listAllCandidatesForAdmin,
  listCandidates,
  updateCandidate,
} from '@/modules/candidate'

export const dynamic = 'force-dynamic'

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  return `https://${trimmed}`
}, z.string().optional())

const candidateBodySchema = z.object({
  title: z.string().min(2).max(120),
  summary: z.string().max(1000).optional(),
  websiteUrl: optionalUrl,
  sourceUrl: optionalUrl,
  logoUrl: optionalUrl,
  previewImageUrl: optionalUrl,
  tags: z.array(z.string().min(1).max(30)).optional(),
  status: z.nativeEnum(CandidateStatus).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

const updateSchema = candidateBodySchema.extend({ id: z.string().min(1) })
const deleteSchema = z.object({ id: z.string().min(1) })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const admin = searchParams.get('admin') === '1'
    const status = searchParams.get('status') as CandidateStatus | null
    const includePromoted = searchParams.get('includePromoted') === '1'

    if (admin) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id || !isAdminSession(session)) {
        return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
      }
      const candidates = await listAllCandidatesForAdmin()
      return NextResponse.json({ candidates })
    }

    const candidates = await listCandidates({
      status: status || undefined,
      includePromoted,
    })
    return NextResponse.json({ candidates })
  } catch (error) {
    console.error('GET /api/candidates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const validated = candidateBodySchema.parse(await request.json())
    const candidate = await createCandidate(validated, session.user.id)
    revalidatePath('/candidates')
    return NextResponse.json({ candidate }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_CANDIDATE_VALIDATION', details: error.errors }, { status: 400 })
    }
    console.error('POST /api/candidates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const validated = updateSchema.parse(await request.json())
    const candidate = await updateCandidate(validated)
    revalidatePath('/candidates')
    revalidatePath(`/candidates/${candidate.slug}`)
    return NextResponse.json({ candidate })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_CANDIDATE_VALIDATION', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ERR_CANDIDATE_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('PATCH /api/candidates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const validated = deleteSchema.parse(await request.json())
    await assertNoEvaluationsForSubject('candidate', validated.id)
    const result = await deleteCandidate(validated.id)
    revalidatePath('/candidates')
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_CANDIDATE_VALIDATION', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ERR_CANDIDATE_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'ERR_SUBJECT_HAS_EVALUATIONS') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('DELETE /api/candidates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
