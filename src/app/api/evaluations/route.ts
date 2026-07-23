import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import {
  EvaluationProtocol,
  EvaluationReproducibility,
  EvaluationStatus,
  EvaluationVerdict,
} from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { parsePage, parsePageSize } from '@/lib/safe-parse'
import { recordAdminAction } from '@/modules/audit'
import {
  createEvaluation,
  listEvaluations,
  updateEvaluation,
} from '@/modules/evaluation'
import { getReviewSubjectPresentation } from '@/shared/reviews/subject'

export const dynamic = 'force-dynamic'

const subjectTypeSchema = z.enum(['target', 'skill', 'app', 'candidate'])

const environmentSchema = z.object({
  model: z.string().max(120).optional(),
  modelVersion: z.string().max(120).optional(),
  software: z.string().max(120).optional(),
  softwareVersion: z.string().max(120).optional(),
  operatingSystem: z.string().max(120).optional(),
  hardware: z.string().max(240).optional(),
  notes: z.string().max(1000).optional(),
}).optional()

const evidenceSchema = z.array(z.object({
  type: z.enum(['url', 'image', 'log', 'code', 'file', 'note']),
  label: z.string().min(1).max(160),
  url: z.string().url().optional(),
  note: z.string().max(1000).optional(),
})).max(30).optional()

const evaluationBodySchema = z.object({
  subjectType: subjectTypeSchema,
  subjectId: z.string().min(1),
  title: z.string().min(2).max(160),
  protocol: z.nativeEnum(EvaluationProtocol).optional(),
  protocolVersion: z.number().int().min(2).max(99).optional(),
  status: z.nativeEnum(EvaluationStatus).optional(),
  verdict: z.nativeEnum(EvaluationVerdict).optional(),
  reproducibility: z.nativeEnum(EvaluationReproducibility).optional(),
  subjectVersion: z.string().max(120).optional(),
  task: z.string().max(10000),
  environment: environmentSchema,
  input: z.string().max(50000).optional(),
  procedure: z.string().max(50000).optional(),
  output: z.string().max(50000).optional(),
  evidence: evidenceSchema,
  scores: z.record(z.number().min(0).max(10)).optional(),
  strengths: z.string().max(10000).optional(),
  limitations: z.string().max(10000).optional(),
  conclusion: z.string().max(20000),
  repeatCount: z.number().int().min(1).max(999).optional(),
  testedAt: z.coerce.date().optional(),
})

const updateSchema = evaluationBodySchema.extend({ id: z.string().min(1) })

function evaluationSubjectPath(evaluation: {
  target?: { name: string; slug: string; type: string } | null
  skill?: { title: string; slug: string } | null
  app?: { title: string; slug: string } | null
  candidate?: { title: string; slug: string } | null
}) {
  return getReviewSubjectPresentation(evaluation)?.href
}

function revalidateEvaluation(evaluation: { id: string } & Parameters<typeof evaluationSubjectPath>[0]) {
  revalidatePath('/evaluations')
  revalidatePath(`/evaluations/${evaluation.id}`)
  revalidatePath('/')
  const subjectPath = evaluationSubjectPath(evaluation)
  if (subjectPath) revalidatePath(subjectPath)
}

function evaluationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'ERR_EVALUATION_VALIDATION', details: error.errors },
      { status: 400 },
    )
  }

  if (error instanceof Error) {
    const notFoundErrors = [
      'ERR_EVALUATION_NOT_FOUND',
      'ERR_TARGET_NOT_FOUND',
      'ERR_SKILL_NOT_FOUND',
      'ERR_APP_NOT_FOUND',
      'ERR_CANDIDATE_NOT_FOUND',
    ]
    if (notFoundErrors.includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message.startsWith('ERR_EVALUATION_')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  console.error('Evaluation API error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const admin = searchParams.get('admin') === '1'
    const subjectTypeRaw = searchParams.get('subjectType')
    const subjectId = searchParams.get('subjectId') || undefined
    const protocolRaw = searchParams.get('protocol')
    const statusRaw = searchParams.get('status')

    if (admin) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id || !isAdminSession(session)) {
        return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
      }
    }

    const subjectType = subjectTypeRaw ? subjectTypeSchema.parse(subjectTypeRaw) : undefined
    const protocol = protocolRaw ? z.nativeEnum(EvaluationProtocol).parse(protocolRaw) : undefined
    const status = statusRaw ? z.nativeEnum(EvaluationStatus).parse(statusRaw) : undefined

    const result = await listEvaluations({
      subjectType,
      subjectId,
      protocol,
      status,
      includeDrafts: admin,
      page: parsePage(searchParams.get('page')),
      pageSize: parsePageSize(searchParams.get('pageSize')),
    })

    return NextResponse.json(result)
  } catch (error) {
    return evaluationError(error)
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

    const validated = evaluationBodySchema.parse(await request.json())
    const evaluation = await createEvaluation(validated, session.user.id)

    await recordAdminAction({
      actorUserId: session.user.id,
      action: 'evaluation.create',
      targetType: 'evaluation',
      targetId: evaluation.id,
      metadata: { protocol: evaluation.protocol, status: evaluation.status },
    })

    revalidateEvaluation(evaluation)
    return NextResponse.json({ evaluation }, { status: 201 })
  } catch (error) {
    return evaluationError(error)
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
    const evaluation = await updateEvaluation(validated)

    await recordAdminAction({
      actorUserId: session.user.id,
      action: 'evaluation.update',
      targetType: 'evaluation',
      targetId: evaluation.id,
      metadata: { protocol: evaluation.protocol, status: evaluation.status },
    })

    revalidateEvaluation(evaluation)
    return NextResponse.json({ evaluation })
  } catch (error) {
    return evaluationError(error)
  }
}
