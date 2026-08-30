import { prisma } from '@/lib/prisma'
import type { ActorContext } from '@/modules/identity'
import { checkAndConsume, checkIpSegmentLimit } from '@/modules/rate-limit'
import {
  AWESOME_COMPUTE_LEVELS,
  AWESOME_DIRECTIONS,
  AWESOME_PROJECT_SCHEMA,
  AWESOME_READINESS,
  type AwesomeComputeLevel,
  type AwesomeDirection,
  type AwesomeLicenseStatus,
  type AwesomeProjectDossier,
  type AwesomeReadiness,
} from '@/content/awesome-projects'

const AWESOME_TAG = 'awesome'
const AWESOME_TAG_FRAGMENT = `"${AWESOME_TAG}"`
const AWESOME_SKILL_TAG_FRAGMENT = '"catalog:skill"'
const CANDIDATE_PRIVATE_TAG = 'visibility:private'
const INTEREST_SCORE_MIN = 1
const INTEREST_SCORE_MAX = 5
const validDirections = new Set<string>(AWESOME_DIRECTIONS.map((item) => item.id))
const validReadiness = new Set<string>(AWESOME_READINESS.map((item) => item.id))
const validComputeLevels = new Set<string>(AWESOME_COMPUTE_LEVELS.map((item) => item.id))
const validLicenseStatuses = new Set<string>(['clear', 'review', 'restricted'])

export interface AwesomeInterestSummary {
  totalScore: number
  averageScore: number | null
  ratingCount: number
  myScore: number | null
}

export interface AwesomeProject {
  id: string
  title: string
  slug: string
  summary: string
  websiteUrl: string | null
  sourceUrl: string | null
  status: string
  sortOrder: number
  tags: string[]
  dossier: AwesomeProjectDossier
  interest: AwesomeInterestSummary
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : []
  } catch {
    return []
  }
}

function directionFromTags(tags: readonly string[]): AwesomeDirection {
  const direction = tags
    .find((tag) => tag.startsWith('direction:'))
    ?.slice('direction:'.length)
  return direction && validDirections.has(direction)
    ? direction as AwesomeDirection
    : 'prompt-quality'
}

function fallbackDossier(title: string, tags: readonly string[]): AwesomeProjectDossier {
  return {
    schema: AWESOME_PROJECT_SCHEMA,
    upstreamName: title,
    direction: directionFromTags(tags),
    license: 'REVIEW REQUIRED',
    licenseStatus: 'review',
    effort: 'TO ESTIMATE',
    readiness: 'radar',
    compute: 'medium',
    artifact: 'WORKING PROTOTYPE',
    posture: 'STUDY',
    whyItMatters: '这条候选仍需补充价值判断和与本站能力的连接。',
    buildProposal: '先完成源码、许可、数据边界和最小可交付审计，再决定集成或自建。',
    firstMilestone: '形成一页可验证的技术与产品调研记录。',
    researchNote: '候选资料尚未结构化，请以项目官方仓库为准。',
  }
}

function parseDossier(
  rawContent: string | null,
  title: string,
  tags: readonly string[],
): AwesomeProjectDossier {
  if (!rawContent) return fallbackDossier(title, tags)

  try {
    const value = JSON.parse(rawContent) as Partial<AwesomeProjectDossier>
    if (
      value.schema !== AWESOME_PROJECT_SCHEMA
      || typeof value.upstreamName !== 'string'
      || typeof value.direction !== 'string'
      || !validDirections.has(value.direction)
      || typeof value.license !== 'string'
      || typeof value.effort !== 'string'
      || !['BUILD', 'INTEGRATE', 'STUDY'].includes(value.posture || '')
      || typeof value.whyItMatters !== 'string'
      || typeof value.buildProposal !== 'string'
      || typeof value.firstMilestone !== 'string'
      || typeof value.researchNote !== 'string'
    ) {
      return fallbackDossier(title, tags)
    }
    return {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: value.upstreamName,
      direction: value.direction as AwesomeDirection,
      license: value.license,
      licenseStatus: validLicenseStatuses.has(value.licenseStatus || '')
        ? value.licenseStatus as AwesomeLicenseStatus
        : 'review',
      effort: value.effort,
      readiness: validReadiness.has(value.readiness || '')
        ? value.readiness as AwesomeReadiness
        : 'radar',
      compute: validComputeLevels.has(value.compute || '')
        ? value.compute as AwesomeComputeLevel
        : 'medium',
      artifact: typeof value.artifact === 'string' && value.artifact.trim()
        ? value.artifact
        : 'WORKING PROTOTYPE',
      posture: value.posture as AwesomeProjectDossier['posture'],
      whyItMatters: value.whyItMatters,
      buildProposal: value.buildProposal,
      firstMilestone: value.firstMilestone,
      researchNote: value.researchNote,
    }
  } catch {
    return fallbackDossier(title, tags)
  }
}

export function rankAwesomeProjects(projects: AwesomeProject[]): AwesomeProject[] {
  return [...projects].sort((left, right) => (
    right.interest.totalScore - left.interest.totalScore
    || right.interest.ratingCount - left.interest.ratingCount
    || (right.interest.averageScore ?? 0) - (left.interest.averageScore ?? 0)
    || left.sortOrder - right.sortOrder
    || left.title.localeCompare(right.title)
  ))
}

export async function listAwesomeProjects(actor?: ActorContext): Promise<AwesomeProject[]> {
  const candidates = await prisma.candidate.findMany({
    where: {
      tags: { contains: AWESOME_TAG_FRAGMENT },
      NOT: [
        { tags: { contains: `"${CANDIDATE_PRIVATE_TAG}"` } },
        { tags: { contains: AWESOME_SKILL_TAG_FRAGMENT } },
      ],
    },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      rawContent: true,
      websiteUrl: true,
      sourceUrl: true,
      tags: true,
      status: true,
      sortOrder: true,
    },
  })

  if (candidates.length === 0) return []

  const candidateIds = candidates.map((candidate) => candidate.id)
  const actorFilter = actor?.userId
    ? { userId: actor.userId }
    : actor?.anonymousUserId
      ? { anonymousUserId: actor.anonymousUserId }
      : null

  const [aggregates, myInterests] = await Promise.all([
    prisma.candidateInterest.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: candidateIds } },
      _sum: { score: true },
      _avg: { score: true },
      _count: { _all: true },
    }),
    actorFilter
      ? prisma.candidateInterest.findMany({
          where: { candidateId: { in: candidateIds }, ...actorFilter },
          select: { candidateId: true, score: true },
        })
      : Promise.resolve([]),
  ])

  const aggregateByCandidate = new Map(
    aggregates.map((aggregate) => [aggregate.candidateId, aggregate]),
  )
  const myScoreByCandidate = new Map(
    myInterests.map((interest) => [interest.candidateId, interest.score]),
  )

  return rankAwesomeProjects(candidates.map((candidate) => {
    const tags = parseTags(candidate.tags)
    const aggregate = aggregateByCandidate.get(candidate.id)
    return {
      id: candidate.id,
      title: candidate.title,
      slug: candidate.slug,
      summary: candidate.summary || '等待补充为什么它值得投入。',
      websiteUrl: candidate.websiteUrl,
      sourceUrl: candidate.sourceUrl,
      status: candidate.status,
      sortOrder: candidate.sortOrder,
      tags: tags.filter((tag) => tag !== AWESOME_TAG),
      dossier: parseDossier(candidate.rawContent, candidate.title, tags),
      interest: {
        totalScore: aggregate?._sum.score ?? 0,
        averageScore: aggregate?._avg.score == null
          ? null
          : Math.round(aggregate._avg.score * 10) / 10,
        ratingCount: aggregate?._count._all ?? 0,
        myScore: myScoreByCandidate.get(candidate.id) ?? null,
      },
    }
  }))
}

function assertInterestActor(actor: ActorContext) {
  const hasUser = Boolean(actor.userId)
  const hasAnonymousUser = Boolean(actor.anonymousUserId)
  if (hasUser === hasAnonymousUser) {
    throw new Error('ERR_INTEREST_IDENTITY_REQUIRED')
  }
}

export async function setAwesomeInterest(
  slug: string,
  score: number,
  actor: ActorContext,
): Promise<AwesomeInterestSummary> {
  if (!Number.isInteger(score) || score < INTEREST_SCORE_MIN || score > INTEREST_SCORE_MAX) {
    throw new Error('ERR_INTEREST_SCORE_INVALID')
  }
  assertInterestActor(actor)

  const candidate = await prisma.candidate.findFirst({
    where: {
      slug,
      tags: { contains: AWESOME_TAG_FRAGMENT },
      NOT: { tags: { contains: `"${CANDIDATE_PRIVATE_TAG}"` } },
    },
    select: { id: true },
  })
  if (!candidate) throw new Error('ERR_AWESOME_PROJECT_NOT_FOUND')

  const rateLimit = await checkAndConsume('like_create', actor)
  if (!rateLimit.allowed) throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  const ipLimit = await checkIpSegmentLimit('like_create', actor)
  if (!ipLimit.allowed) throw new Error('ERR_RATE_LIMIT_EXCEEDED')

  return prisma.$transaction(async (tx) => {
    if (actor.userId) {
      await tx.candidateInterest.upsert({
        where: {
          candidateId_userId: {
            candidateId: candidate.id,
            userId: actor.userId,
          },
        },
        update: { score },
        create: {
          candidateId: candidate.id,
          userId: actor.userId,
          score,
        },
      })
    } else {
      await tx.candidateInterest.upsert({
        where: {
          candidateId_anonymousUserId: {
            candidateId: candidate.id,
            anonymousUserId: actor.anonymousUserId!,
          },
        },
        update: { score },
        create: {
          candidateId: candidate.id,
          anonymousUserId: actor.anonymousUserId!,
          score,
        },
      })
    }

    const aggregate = await tx.candidateInterest.aggregate({
      where: { candidateId: candidate.id },
      _sum: { score: true },
      _avg: { score: true },
      _count: { _all: true },
    })

    return {
      totalScore: aggregate._sum.score ?? 0,
      averageScore: aggregate._avg.score == null
        ? null
        : Math.round(aggregate._avg.score * 10) / 10,
      ratingCount: aggregate._count._all,
      myScore: score,
    }
  })
}
