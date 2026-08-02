import { CandidatePromoteTo, CandidateStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { skillDetailPath } from '@/shared/skills/taxonomy'

export type PromotedSubjectType = 'target' | 'skill' | 'app'

interface CandidatePromotionReference {
  promotedTo: CandidatePromoteTo | null
  promotedTargetId: string | null
  promotedSkillId: string | null
  promotedAppId: string | null
}

export interface PromotionDestination {
  subjectType: PromotedSubjectType
  subjectId: string
  title: string
  href: string
}

export interface PromotionOrigin {
  id: string
  title: string
  slug: string
  href: string
  reviewCount: number
  evaluationCount: number
}

export interface PromotionOriginLink {
  id: string
  title: string
  slug: string
  promotedTargetId: string | null
  promotedSkillId: string | null
  promotedAppId: string | null
}

export async function resolvePromotionDestination(
  candidate: CandidatePromotionReference,
): Promise<PromotionDestination | null> {
  if (candidate.promotedTo === CandidatePromoteTo.tool && candidate.promotedTargetId) {
    const target = await prisma.target.findUnique({
      where: { id: candidate.promotedTargetId },
      select: { id: true, name: true, slug: true, type: true },
    })
    return target
      ? {
          subjectType: 'target',
          subjectId: target.id,
          title: target.name,
          href: skillDetailPath(target.type, target.slug),
        }
      : null
  }

  if (candidate.promotedTo === CandidatePromoteTo.skill && candidate.promotedSkillId) {
    const skill = await prisma.skill.findUnique({
      where: { id: candidate.promotedSkillId },
      select: { id: true, title: true, slug: true },
    })
    return skill
      ? {
          subjectType: 'skill',
          subjectId: skill.id,
          title: skill.title,
          href: `/skills/${skill.slug}`,
        }
      : null
  }

  if (candidate.promotedTo === CandidatePromoteTo.gallery && candidate.promotedAppId) {
    const app = await prisma.app.findUnique({
      where: { id: candidate.promotedAppId },
      select: { id: true, title: true, slug: true },
    })
    return app
      ? {
          subjectType: 'app',
          subjectId: app.id,
          title: app.title,
          href: `/app/${app.slug}`,
        }
      : null
  }

  return null
}

export async function findPromotionOrigin(
  subjectType: PromotedSubjectType,
  subjectId: string,
): Promise<PromotionOrigin | null> {
  const promotedField = subjectType === 'target'
    ? { promotedTargetId: subjectId }
    : subjectType === 'skill'
      ? { promotedSkillId: subjectId }
      : { promotedAppId: subjectId }

  const candidate = await prisma.candidate.findFirst({
    where: {
      status: CandidateStatus.promoted,
      ...promotedField,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      _count: {
        select: {
          reviews: { where: { status: 'published' } },
          evaluations: { where: { status: 'published' } },
        },
      },
    },
  })

  return candidate
    ? {
        id: candidate.id,
        title: candidate.title,
        slug: candidate.slug,
        href: `/candidates/${candidate.slug}`,
        reviewCount: candidate._count.reviews,
        evaluationCount: candidate._count.evaluations,
      }
    : null
}

export async function listPromotionOriginsForSubjects(input: {
  targetIds: string[]
  skillIds: string[]
  appIds: string[]
}): Promise<PromotionOriginLink[]> {
  const filters: Prisma.CandidateWhereInput[] = [
    ...(input.targetIds.length ? [{ promotedTargetId: { in: input.targetIds } }] : []),
    ...(input.skillIds.length ? [{ promotedSkillId: { in: input.skillIds } }] : []),
    ...(input.appIds.length ? [{ promotedAppId: { in: input.appIds } }] : []),
  ]
  if (filters.length === 0) return []

  return prisma.candidate.findMany({
    where: {
      status: CandidateStatus.promoted,
      OR: filters,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      promotedTargetId: true,
      promotedSkillId: true,
      promotedAppId: true,
    },
  })
}
