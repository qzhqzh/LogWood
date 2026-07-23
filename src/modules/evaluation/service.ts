import {
  EvaluationProtocol,
  EvaluationReproducibility,
  EvaluationStatus,
  EvaluationVerdict,
  Prisma,
  TargetType,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ReviewSubjectType } from '@/modules/review/constants'
import {
  EVALUATION_PROTOCOL_VERSION,
  EVALUATION_PROTOCOLS,
} from './constants'

export type EvaluationSubjectType = ReviewSubjectType

export interface EvaluationEnvironment {
  model?: string
  modelVersion?: string
  software?: string
  softwareVersion?: string
  operatingSystem?: string
  hardware?: string
  notes?: string
}

export interface EvaluationEvidence {
  type: 'url' | 'image' | 'log' | 'code' | 'file' | 'note'
  label: string
  url?: string
  note?: string
}

export interface EvaluationInput {
  subjectType: EvaluationSubjectType
  subjectId: string
  title: string
  protocol?: EvaluationProtocol
  protocolVersion?: number
  status?: EvaluationStatus
  verdict?: EvaluationVerdict
  reproducibility?: EvaluationReproducibility
  subjectVersion?: string
  task: string
  environment?: EvaluationEnvironment
  input?: string
  procedure?: string
  output?: string
  evidence?: EvaluationEvidence[]
  scores?: Record<string, number>
  strengths?: string
  limitations?: string
  conclusion: string
  repeatCount?: number
  testedAt?: Date
}

export interface UpdateEvaluationInput extends EvaluationInput {
  id: string
}

export interface EvaluationQuery {
  subjectType?: EvaluationSubjectType
  subjectId?: string
  protocol?: EvaluationProtocol
  status?: EvaluationStatus
  page?: number
  pageSize?: number
  includeDrafts?: boolean
}

interface ResolvedSubject {
  subjectType: EvaluationSubjectType
  subjectId: string
  protocol: EvaluationProtocol
  title: string
  href: string
}

function cleanOptionalText(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function cleanEnvironment(environment?: EvaluationEnvironment): EvaluationEnvironment | null {
  if (!environment) return null
  const entries = Object.entries(environment)
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value] as const)
    .filter(([, value]) => value !== undefined && value !== '')
  return entries.length > 0 ? Object.fromEntries(entries) as EvaluationEnvironment : null
}

function cleanEvidence(evidence?: EvaluationEvidence[]): EvaluationEvidence[] {
  return (evidence || [])
    .map((item) => ({
      type: item.type,
      label: item.label.trim(),
      url: cleanOptionalText(item.url) || undefined,
      note: cleanOptionalText(item.note) || undefined,
    }))
    .filter((item) => item.label.length > 0)
}

function protocolForTarget(type: TargetType): EvaluationProtocol {
  if (type === TargetType.model) return EvaluationProtocol.model
  if (type === TargetType.editor || type === TargetType.coding) return EvaluationProtocol.software
  return EvaluationProtocol.resource
}

async function resolveSubject(
  subjectType: EvaluationSubjectType,
  subjectId: string,
): Promise<ResolvedSubject> {
  if (subjectType === 'skill') {
    const subject = await prisma.skill.findUnique({
      where: { id: subjectId },
      select: { id: true, title: true, slug: true },
    })
    if (!subject) throw new Error('ERR_SKILL_NOT_FOUND')
    return {
      subjectType,
      subjectId,
      protocol: EvaluationProtocol.skill,
      title: subject.title,
      href: `/skills/${subject.slug}`,
    }
  }

  if (subjectType === 'target') {
    const subject = await prisma.target.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true, slug: true, type: true },
    })
    if (!subject) throw new Error('ERR_TARGET_NOT_FOUND')
    return {
      subjectType,
      subjectId,
      protocol: protocolForTarget(subject.type),
      title: subject.name,
      href: `/${subject.type}/${subject.slug}`,
    }
  }

  if (subjectType === 'app') {
    const subject = await prisma.app.findUnique({
      where: { id: subjectId },
      select: { id: true, title: true, slug: true },
    })
    if (!subject) throw new Error('ERR_APP_NOT_FOUND')
    return {
      subjectType,
      subjectId,
      protocol: EvaluationProtocol.resource,
      title: subject.title,
      href: `/app/${subject.slug}`,
    }
  }

  const subject = await prisma.candidate.findUnique({
    where: { id: subjectId },
    select: { id: true, title: true, slug: true },
  })
  if (!subject) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  return {
    subjectType,
    subjectId,
    protocol: EvaluationProtocol.resource,
    title: subject.title,
    href: `/candidates/${subject.slug}`,
  }
}

function subjectCreateData(subjectType: EvaluationSubjectType, subjectId: string) {
  return {
    targetId: subjectType === 'target' ? subjectId : null,
    skillId: subjectType === 'skill' ? subjectId : null,
    appId: subjectType === 'app' ? subjectId : null,
    candidateId: subjectType === 'candidate' ? subjectId : null,
  }
}

function validateScores(
  protocol: EvaluationProtocol,
  scores: Record<string, number> | undefined,
  status: EvaluationStatus,
) {
  const definition = EVALUATION_PROTOCOLS[protocol]
  const allowedKeys = new Set(definition.dimensions.map((item) => item.key))
  const values = scores || {}

  for (const [key, value] of Object.entries(values)) {
    if (!allowedKeys.has(key) || !Number.isFinite(value) || value < 0 || value > 10) {
      throw new Error('ERR_EVALUATION_SCORES')
    }
  }

  if (status === EvaluationStatus.published) {
    const missing = definition.dimensions.some((item) => values[item.key] === undefined)
    if (missing) throw new Error('ERR_EVALUATION_SCORES_INCOMPLETE')
  }
}

function validatePublication(input: EvaluationInput, protocol: EvaluationProtocol) {
  const status = input.status ?? EvaluationStatus.draft
  const repeatCount = input.repeatCount ?? 1
  const evidence = cleanEvidence(input.evidence)

  if (repeatCount < 1 || repeatCount > 999) {
    throw new Error('ERR_EVALUATION_REPEAT_COUNT')
  }

  validateScores(protocol, input.scores, status)

  if (status !== EvaluationStatus.published) return

  if (input.title.trim().length < 4 || input.task.trim().length < 10 || input.conclusion.trim().length < 10) {
    throw new Error('ERR_EVALUATION_PUBLICATION_INCOMPLETE')
  }

  const hasOutput = Boolean(input.output?.trim() && input.output.trim().length >= 10)
  if (!hasOutput && evidence.length === 0) {
    throw new Error('ERR_EVALUATION_EVIDENCE_REQUIRED')
  }

  const reproducibility = input.reproducibility ?? EvaluationReproducibility.untested
  if (reproducibility === EvaluationReproducibility.untested) {
    throw new Error('ERR_EVALUATION_REPRODUCIBILITY_REQUIRED')
  }
  if (
    (reproducibility === EvaluationReproducibility.repeated ||
      reproducibility === EvaluationReproducibility.reproduced) &&
    repeatCount < 2
  ) {
    throw new Error('ERR_EVALUATION_REPEAT_COUNT')
  }
}

function evaluationInclude() {
  return {
    author: { select: { id: true, name: true, avatarUrl: true } },
    target: { select: { id: true, name: true, slug: true, type: true } },
    skill: { select: { id: true, title: true, slug: true } },
    app: { select: { id: true, title: true, slug: true } },
    candidate: { select: { id: true, title: true, slug: true } },
  } as const
}

export async function createEvaluation(input: EvaluationInput, authorUserId: string) {
  const subject = await resolveSubject(input.subjectType, input.subjectId)
  const protocol = input.protocol ?? subject.protocol
  if (protocol !== subject.protocol) throw new Error('ERR_EVALUATION_PROTOCOL_MISMATCH')
  validatePublication(input, protocol)

  const status = input.status ?? EvaluationStatus.draft
  const evidence = cleanEvidence(input.evidence)
  const environment = cleanEnvironment(input.environment)

  return prisma.evaluation.create({
    data: {
      authorUserId,
      ...subjectCreateData(input.subjectType, input.subjectId),
      title: input.title.trim(),
      protocol,
      protocolVersion: input.protocolVersion ?? EVALUATION_PROTOCOL_VERSION,
      status,
      verdict: input.verdict ?? EvaluationVerdict.inconclusive,
      reproducibility: input.reproducibility ?? EvaluationReproducibility.untested,
      subjectVersion: cleanOptionalText(input.subjectVersion),
      task: input.task.trim(),
      environment: environment as Prisma.InputJsonValue | undefined,
      input: cleanOptionalText(input.input),
      procedure: cleanOptionalText(input.procedure),
      output: cleanOptionalText(input.output),
      evidence: evidence.length > 0 ? evidence as Prisma.InputJsonValue : undefined,
      scores: input.scores ? input.scores as Prisma.InputJsonValue : undefined,
      strengths: cleanOptionalText(input.strengths),
      limitations: cleanOptionalText(input.limitations),
      conclusion: input.conclusion.trim(),
      repeatCount: input.repeatCount ?? 1,
      testedAt: input.testedAt ?? new Date(),
      publishedAt: status === EvaluationStatus.published ? new Date() : null,
    },
    include: evaluationInclude(),
  })
}

export async function updateEvaluation(input: UpdateEvaluationInput) {
  const existing = await prisma.evaluation.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_EVALUATION_NOT_FOUND')

  const subject = await resolveSubject(input.subjectType, input.subjectId)
  const protocol = input.protocol ?? subject.protocol
  if (protocol !== subject.protocol) throw new Error('ERR_EVALUATION_PROTOCOL_MISMATCH')
  validatePublication(input, protocol)

  const status = input.status ?? existing.status
  const evidence = cleanEvidence(input.evidence)
  const environment = cleanEnvironment(input.environment)

  return prisma.evaluation.update({
    where: { id: input.id },
    data: {
      ...subjectCreateData(input.subjectType, input.subjectId),
      title: input.title.trim(),
      protocol,
      protocolVersion: input.protocolVersion ?? existing.protocolVersion,
      status,
      verdict: input.verdict ?? existing.verdict,
      reproducibility: input.reproducibility ?? existing.reproducibility,
      subjectVersion: cleanOptionalText(input.subjectVersion),
      task: input.task.trim(),
      environment: environment === null ? Prisma.JsonNull : environment as Prisma.InputJsonValue,
      input: cleanOptionalText(input.input),
      procedure: cleanOptionalText(input.procedure),
      output: cleanOptionalText(input.output),
      evidence: evidence.length > 0 ? evidence as Prisma.InputJsonValue : Prisma.JsonNull,
      scores: input.scores ? input.scores as Prisma.InputJsonValue : Prisma.JsonNull,
      strengths: cleanOptionalText(input.strengths),
      limitations: cleanOptionalText(input.limitations),
      conclusion: input.conclusion.trim(),
      repeatCount: input.repeatCount ?? existing.repeatCount,
      testedAt: input.testedAt ?? existing.testedAt,
      publishedAt:
        status === EvaluationStatus.published
          ? existing.publishedAt ?? new Date()
          : existing.publishedAt,
    },
    include: evaluationInclude(),
  })
}

export async function listEvaluations(query: EvaluationQuery = {}) {
  const {
    subjectType,
    subjectId,
    protocol,
    status,
    page = 1,
    pageSize = 20,
    includeDrafts = false,
  } = query

  const where: Prisma.EvaluationWhereInput = {}
  if (!includeDrafts) where.status = EvaluationStatus.published
  else if (status) where.status = status
  if (protocol) where.protocol = protocol
  if (subjectType && subjectId) {
    where[`${subjectType}Id` as 'targetId' | 'skillId' | 'appId' | 'candidateId'] = subjectId
  }

  const [evaluations, total] = await Promise.all([
    prisma.evaluation.findMany({
      where,
      include: evaluationInclude(),
      orderBy: [{ testedAt: 'desc' }, { updatedAt: 'desc' }],
      skip: (Math.max(page, 1) - 1) * pageSize,
      take: pageSize,
    }),
    prisma.evaluation.count({ where }),
  ])

  return { evaluations, total }
}

export async function getEvaluationById(id: string, includeDraft = false) {
  return prisma.evaluation.findFirst({
    where: {
      id,
      ...(includeDraft ? {} : { status: EvaluationStatus.published }),
    },
    include: evaluationInclude(),
  })
}

export async function listPublishedEvaluationsForSubject(
  subjectType: EvaluationSubjectType,
  subjectId: string,
  take = 4,
) {
  const where: Prisma.EvaluationWhereInput = {
    status: EvaluationStatus.published,
    [`${subjectType}Id`]: subjectId,
  }
  return prisma.evaluation.findMany({
    where,
    include: evaluationInclude(),
    orderBy: [{ testedAt: 'desc' }, { updatedAt: 'desc' }],
    take,
  })
}

export async function countPublishedEvaluations() {
  return prisma.evaluation.count({ where: { status: EvaluationStatus.published } })
}
