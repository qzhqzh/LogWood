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
  protocol: EvaluationProtocol
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
    .map((item) => {
      const cleaned: EvaluationEvidence = {
        type: item.type,
        label: item.label.trim(),
      }
      const url = cleanOptionalText(item.url)
      const note = cleanOptionalText(item.note)
      if (url) cleaned.url = url
      if (note) cleaned.note = note
      return cleaned
    })
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
      select: { id: true },
    })
    if (!subject) throw new Error('ERR_SKILL_NOT_FOUND')
    return { protocol: EvaluationProtocol.skill }
  }

  if (subjectType === 'target') {
    const subject = await prisma.target.findUnique({
      where: { id: subjectId },
      select: { id: true, type: true },
    })
    if (!subject) throw new Error('ERR_TARGET_NOT_FOUND')
    return { protocol: protocolForTarget(subject.type) }
  }

  if (subjectType === 'app') {
    const subject = await prisma.app.findUnique({
      where: { id: subjectId },
      select: { id: true },
    })
    if (!subject) throw new Error('ERR_APP_NOT_FOUND')
    return { protocol: EvaluationProtocol.resource }
  }

  const subject = await prisma.candidate.findUnique({
    where: { id: subjectId },
    select: { id: true },
  })
  if (!subject) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  return { protocol: EvaluationProtocol.resource }
}

function subjectCreateData(subjectType: EvaluationSubjectType, subjectId: string) {
  return {
    targetId: subjectType === 'target' ? subjectId : null,
    skillId: subjectType === 'skill' ? subjectId : null,
    appId: subjectType === 'app' ? subjectId : null,
    candidateId: subjectType === 'candidate' ? subjectId : null,
  }
}

function subjectWhere(subjectType: EvaluationSubjectType, subjectId: string): Prisma.EvaluationWhereInput {
  if (subjectType === 'target') return { targetId: subjectId }
  if (subjectType === 'skill') return { skillId: subjectId }
  if (subjectType === 'app') return { appId: subjectId }
  return { candidateId: subjectId }
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
      environment: environment ? environment as Prisma.InputJsonValue : undefined,
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
  const status = input.status ?? existing.status
  validatePublication({ ...input, status }, protocol)

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

  const where: Prisma.EvaluationWhereInput = {
    ...(!includeDrafts ? { status: EvaluationStatus.published } : status ? { status } : {}),
    ...(protocol ? { protocol } : {}),
    ...(subjectType && subjectId ? subjectWhere(subjectType, subjectId) : {}),
  }
  const safePageSize = Math.max(1, Math.min(pageSize, 100))

  const [evaluations, total] = await Promise.all([
    prisma.evaluation.findMany({
      where,
      include: evaluationInclude(),
      orderBy: [{ testedAt: 'desc' }, { updatedAt: 'desc' }],
      skip: (Math.max(page, 1) - 1) * safePageSize,
      take: safePageSize,
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
  return prisma.evaluation.findMany({
    where: {
      status: EvaluationStatus.published,
      ...subjectWhere(subjectType, subjectId),
    },
    include: evaluationInclude(),
    orderBy: [{ testedAt: 'desc' }, { updatedAt: 'desc' }],
    take: Math.max(1, Math.min(take, 20)),
  })
}

export async function countPublishedEvaluations() {
  return prisma.evaluation.count({ where: { status: EvaluationStatus.published } })
}
