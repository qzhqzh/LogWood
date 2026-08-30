import { prisma } from '@/lib/prisma'
import type { ActorContext } from '@/modules/identity'
import {
  AWESOME_SKILL_CATEGORIES,
  AWESOME_SKILL_COMPATIBILITY,
  AWESOME_SKILL_EFFORTS,
  AWESOME_SKILL_KINDS,
  AWESOME_SKILL_MATURITY,
  AWESOME_SKILL_PERMISSIONS,
  AWESOME_SKILL_SCHEMA,
  type AwesomeSkillCategory,
  type AwesomeSkillCompatibility,
  type AwesomeSkillDossier,
  type AwesomeSkillEffort,
  type AwesomeSkillKind,
  type AwesomeSkillLicenseStatus,
  type AwesomeSkillMaturity,
  type AwesomeSkillPermission,
} from '@/content/awesome-skills'
import type { AwesomeInterestSummary } from './awesome'

const AWESOME_TAG_FRAGMENT = '"awesome"'
const AWESOME_SKILL_TAG_FRAGMENT = '"catalog:skill"'
const CANDIDATE_PRIVATE_TAG_FRAGMENT = '"visibility:private"'

const validCategories = new Set<string>(AWESOME_SKILL_CATEGORIES.map((item) => item.id))
const validKinds = new Set<string>(AWESOME_SKILL_KINDS.map((item) => item.id))
const validCompatibility = new Set<string>(AWESOME_SKILL_COMPATIBILITY.map((item) => item.id))
const validMaturity = new Set<string>(AWESOME_SKILL_MATURITY.map((item) => item.id))
const validPermissions = new Set<string>(AWESOME_SKILL_PERMISSIONS.map((item) => item.id))
const validEfforts = new Set<string>(AWESOME_SKILL_EFFORTS.map((item) => item.id))
const validLicenseStatuses = new Set<string>(['clear', 'review', 'restricted'])

export interface AwesomeSkillEntry {
  id: string
  title: string
  slug: string
  summary: string
  websiteUrl: string | null
  sourceUrl: string | null
  status: string
  sortOrder: number
  tags: string[]
  dossier: AwesomeSkillDossier
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

function taggedValue<T extends string>(
  tags: readonly string[],
  prefix: string,
  valid: Set<string>,
  fallback: T,
): T {
  const value = tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length)
  return value && valid.has(value) ? value as T : fallback
}

function fallbackDossier(title: string, tags: readonly string[]): AwesomeSkillDossier {
  return {
    schema: AWESOME_SKILL_SCHEMA,
    upstreamName: title,
    category: taggedValue(tags, 'skill-category:', validCategories, 'agents'),
    kinds: [taggedValue(tags, 'skill-kind:', validKinds, 'instructions')],
    compatibility: [taggedValue(tags, 'compatibility:', validCompatibility, 'generic')],
    permissions: [taggedValue(tags, 'permission:', validPermissions, 'read-only')],
    maturity: taggedValue(tags, 'maturity:', validMaturity, 'collected'),
    effort: '30-min',
    license: 'REVIEW REQUIRED',
    licenseStatus: 'review',
    artifact: 'SKILL AUDIT NOTE',
    whyItMatters: '这条 Skill 仍需补充适用边界、风险与本站能力的连接。',
    firstLook: '先阅读完整 SKILL.md、依赖资源和权限，再决定是否在隔离环境试用。',
    auditNote: '目录元数据尚不完整，请以公开上游和具体版本为准。',
    skillUrl: '',
  }
}

function hasOnlyValidValues(value: unknown, valid: Set<string>): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === 'string' && valid.has(item))
}

function parseDossier(
  rawContent: string | null,
  title: string,
  tags: readonly string[],
): AwesomeSkillDossier {
  if (!rawContent) return fallbackDossier(title, tags)

  try {
    const value = JSON.parse(rawContent) as Partial<AwesomeSkillDossier>
    if (
      value.schema !== AWESOME_SKILL_SCHEMA
      || typeof value.upstreamName !== 'string'
      || typeof value.category !== 'string'
      || !validCategories.has(value.category)
      || !hasOnlyValidValues(value.kinds, validKinds)
      || !hasOnlyValidValues(value.compatibility, validCompatibility)
      || !hasOnlyValidValues(value.permissions, validPermissions)
      || typeof value.maturity !== 'string'
      || !validMaturity.has(value.maturity)
      || typeof value.effort !== 'string'
      || !validEfforts.has(value.effort)
      || typeof value.license !== 'string'
      || typeof value.artifact !== 'string'
      || typeof value.whyItMatters !== 'string'
      || typeof value.firstLook !== 'string'
      || typeof value.auditNote !== 'string'
      || typeof value.skillUrl !== 'string'
    ) {
      return fallbackDossier(title, tags)
    }

    return {
      schema: AWESOME_SKILL_SCHEMA,
      upstreamName: value.upstreamName,
      category: value.category as AwesomeSkillCategory,
      kinds: value.kinds as AwesomeSkillKind[],
      compatibility: value.compatibility as AwesomeSkillCompatibility[],
      permissions: value.permissions as AwesomeSkillPermission[],
      maturity: value.maturity as AwesomeSkillMaturity,
      effort: value.effort as AwesomeSkillEffort,
      license: value.license,
      licenseStatus: validLicenseStatuses.has(value.licenseStatus || '')
        ? value.licenseStatus as AwesomeSkillLicenseStatus
        : 'review',
      artifact: value.artifact,
      whyItMatters: value.whyItMatters,
      firstLook: value.firstLook,
      auditNote: value.auditNote,
      skillUrl: value.skillUrl,
      ...(typeof value.promptSlug === 'string' && value.promptSlug.trim()
        ? { promptSlug: value.promptSlug }
        : {}),
    }
  } catch {
    return fallbackDossier(title, tags)
  }
}

export function rankAwesomeSkills(skills: AwesomeSkillEntry[]): AwesomeSkillEntry[] {
  return [...skills].sort((left, right) => (
    right.interest.totalScore - left.interest.totalScore
    || right.interest.ratingCount - left.interest.ratingCount
    || (right.interest.averageScore ?? 0) - (left.interest.averageScore ?? 0)
    || left.sortOrder - right.sortOrder
    || left.title.localeCompare(right.title)
  ))
}

export async function listAwesomeSkills(actor?: ActorContext): Promise<AwesomeSkillEntry[]> {
  const candidates = await prisma.candidate.findMany({
    where: {
      AND: [
        { tags: { contains: AWESOME_TAG_FRAGMENT } },
        { tags: { contains: AWESOME_SKILL_TAG_FRAGMENT } },
      ],
      NOT: { tags: { contains: CANDIDATE_PRIVATE_TAG_FRAGMENT } },
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

  return rankAwesomeSkills(candidates.map((candidate) => {
    const tags = parseTags(candidate.tags)
    const aggregate = aggregateByCandidate.get(candidate.id)
    return {
      id: candidate.id,
      title: candidate.title,
      slug: candidate.slug,
      summary: candidate.summary || '等待补充 Skill 能力与适用边界。',
      websiteUrl: candidate.websiteUrl,
      sourceUrl: candidate.sourceUrl,
      status: candidate.status,
      sortOrder: candidate.sortOrder,
      tags: tags.filter((tag) => tag !== 'awesome' && tag !== 'catalog:skill'),
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
