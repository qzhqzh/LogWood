import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  CandidatePromoteTo,
  CandidateStatus,
  Prisma,
} from '@prisma/client'
import { createApp, CreateAppInput } from '@/modules/app'
import { createSkill, CreateSkillInput } from '@/modules/skill'
import { candidateStatusLabel } from './constants'

export {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  candidateStatusLabel,
} from './constants'


export interface CreateCandidateInput {
  title: string
  ideaKey?: string
  summary?: string
  websiteUrl?: string
  sourceUrl?: string
  logoUrl?: string
  previewImageUrl?: string
  tags?: string[]
  status?: CandidateStatus
  sortOrder?: number
}

export interface UpdateCandidateInput extends CreateCandidateInput {
  id: string
}

export interface PromoteCandidateInput {
  id: string
  to: 'skill' | 'gallery'
  skill?: CreateSkillInput
  app?: CreateAppInput
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || `candidate-${Date.now()}`
  )
}

async function ensureUniqueSlug(baseSlug: string, ignoreId?: string): Promise<string> {
  let slug = baseSlug
  let i = 1
  while (true) {
    const existing = await prisma.candidate.findUnique({ where: { slug } })
    if (!existing || existing.id === ignoreId) return slug
    i += 1
    slug = `${baseSlug}-${i}`
  }
}

function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

function mapCandidate<T extends { tags: string }>(
  candidate: T,
): Omit<T, 'tags'> & { tags: string[] } {
  return {
    ...candidate,
    tags: parseTags(candidate.tags),
  }
}

export async function listCandidates(opts?: {
  status?: CandidateStatus
  includePromoted?: boolean
  search?: string
  authorUserId?: string
  limit?: number
}) {
  const where: Prisma.CandidateWhereInput = {}
  if (opts?.authorUserId) {
    where.authorUserId = opts.authorUserId
  }
  if (opts?.status) {
    where.status = opts.status
  } else if (!opts?.includePromoted) {
    where.status = { in: [CandidateStatus.watching, CandidateStatus.evaluating] }
  }
  const search = opts?.search?.trim()
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { tags: { contains: search, mode: 'insensitive' } },
    ]
  }

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    ...(opts?.limit ? { take: opts.limit } : {}),
    include: {
      _count: { select: { reviews: { where: { status: 'published' } } } },
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
  })

  return candidates.map((c) => {
    const ratings = c.reviews.map((r) => r.rating)
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null
    const { reviews, ...rest } = c
    return {
      ...mapCandidate(rest),
      reviewCount: c._count.reviews,
      avgRating,
    }
  })
}

export async function listAllCandidatesForAdmin() {
  const candidates = await prisma.candidate.findMany({
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    include: {
      _count: { select: { reviews: { where: { status: 'published' } } } },
    },
  })
  return candidates.map((c) => ({
    ...mapCandidate(c),
    reviewCount: c._count.reviews,
  }))
}

export async function getCandidateBySlug(slug: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { slug },
    include: {
      _count: { select: { reviews: { where: { status: 'published' } } } },
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
  })
  if (!candidate) return null

  const ratings = candidate.reviews.map((r) => r.rating)
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null
  const { reviews, ...rest } = candidate
  return {
    ...mapCandidate(rest),
    reviewCount: candidate._count.reviews,
    avgRating,
  }
}

export async function getCandidateById(id: string) {
  const candidate = await prisma.candidate.findUnique({ where: { id } })
  return candidate ? mapCandidate(candidate) : null
}

export async function organizeCandidate(input: {
  id: string
  tags?: string[]
  status?: CandidateStatus
}) {
  const existing = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (existing.status === CandidateStatus.promoted && input.status) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }

  return prisma.candidate
    .update({
      where: { id: input.id },
      data: {
        ...(input.tags ? { tags: JSON.stringify(input.tags) } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    })
    .then(mapCandidate)
}

export async function findCandidateDuplicate(input: {
  ideaKey: string
  title: string
  sourceUrl?: string
  authorUserId: string
}) {
  const conditions: Prisma.CandidateWhereInput[] = [
    { slug: buildCandidateIdeaSlug(input.ideaKey, input.authorUserId) },
  ]
  if (input.sourceUrl) {
    conditions.push({ sourceUrl: input.sourceUrl.trim() })
  } else {
    conditions.push({ title: { equals: input.title.trim(), mode: 'insensitive' } })
  }

  const candidate = await prisma.candidate.findFirst({
    where: {
      authorUserId: input.authorUserId,
      OR: conditions,
    },
  })
  return candidate ? mapCandidate(candidate) : null
}

function buildCandidateIdeaSlug(ideaKey: string, authorUserId: string): string {
  const identity = `${authorUserId}:${ideaKey}`
  return `idea-${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`
}

export async function createCandidate(input: CreateCandidateInput, authorUserId?: string) {
  const slug = input.ideaKey
    ? buildCandidateIdeaSlug(input.ideaKey, authorUserId || 'system')
    : await ensureUniqueSlug(slugify(input.title))
  return prisma.candidate
    .create({
      data: {
        title: input.title.trim(),
        slug,
        summary: input.summary?.trim() || null,
        websiteUrl: input.websiteUrl?.trim() || null,
        sourceUrl: input.sourceUrl?.trim() || null,
        logoUrl: input.logoUrl?.trim() || null,
        previewImageUrl: input.previewImageUrl?.trim() || null,
        tags: JSON.stringify(input.tags || []),
        status: input.status ?? CandidateStatus.watching,
        sortOrder: input.sortOrder ?? 0,
        authorUserId,
      },
    })
    .then(mapCandidate)
}

export async function updateCandidate(input: UpdateCandidateInput) {
  const existing = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')

  let slug = existing.slug
  if (input.title.trim() !== existing.title && !existing.slug.startsWith('idea-')) {
    slug = await ensureUniqueSlug(slugify(input.title), existing.id)
  }

  return prisma.candidate
    .update({
      where: { id: input.id },
      data: {
        title: input.title.trim(),
        slug,
        summary: input.summary?.trim() || null,
        websiteUrl: input.websiteUrl?.trim() || null,
        sourceUrl: input.sourceUrl?.trim() || null,
        logoUrl: input.logoUrl?.trim() || null,
        previewImageUrl: input.previewImageUrl?.trim() || null,
        tags: JSON.stringify(input.tags || []),
        status: input.status ?? existing.status,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
    })
    .then(mapCandidate)
}

export async function deleteCandidate(id: string) {
  const existing = await prisma.candidate.findUnique({ where: { id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  return prisma.candidate.delete({ where: { id }, select: { id: true, slug: true } })
}

export async function promoteCandidate(input: PromoteCandidateInput) {
  const candidate = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!candidate) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (candidate.status === CandidateStatus.promoted) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }

  if (input.to === 'skill') {
    const sourceUrl = candidate.sourceUrl || candidate.websiteUrl
    return prisma.$transaction(async (tx) => {
      const skillInput: CreateSkillInput = input.skill ?? {
        title: candidate.title,
        category: 'other',
        summary: candidate.summary || candidate.title,
        prompt: [
          `待复用内容：${candidate.summary || candidate.title}`,
          sourceUrl ? `来源：${sourceUrl}` : null,
        ].filter(Boolean).join('\n\n'),
        effectImageUrl: candidate.previewImageUrl || candidate.logoUrl || undefined,
        sourceUrl: sourceUrl || undefined,
        tags: parseTags(candidate.tags),
        status: 'published',
      }
      const skill = await createSkill(skillInput, candidate.authorUserId || undefined, tx)

      const updatedCandidate = await markCandidatePromoted(tx, candidate, {
        promotedTo: CandidatePromoteTo.skill,
        promotedSkillId: skill.id,
      })
      return {
        candidate: updatedCandidate,
        promoted: { type: 'skill' as const, id: skill.id, slug: skill.slug },
      }
    })
  }

  const previewImageUrl = input.app?.previewImageUrl
    || candidate.previewImageUrl
    || candidate.logoUrl
  if (!previewImageUrl) {
    throw new Error('ERR_CANDIDATE_IMAGE_REQUIRED')
  }

  const appInput: CreateAppInput = input.app
    ? { ...input.app, previewImageUrl }
    : {
        name: candidate.title,
        appUrl: candidate.websiteUrl
          || candidate.sourceUrl
          || `/candidates/${candidate.slug}`,
        title: candidate.title,
        summary: candidate.summary || candidate.title,
        description: candidate.summary || candidate.title,
        previewImageUrl,
        tags: parseTags(candidate.tags),
        status: 'published',
      }
  return prisma.$transaction(async (tx) => {
    const app = await createApp(appInput, candidate.authorUserId || undefined, tx)

    const updatedCandidate = await markCandidatePromoted(tx, candidate, {
        promotedTo: CandidatePromoteTo.gallery,
        promotedAppId: app.id,
    })
    return {
      candidate: updatedCandidate,
      promoted: { type: 'gallery' as const, id: app.id, slug: app.slug },
    }
  })
}

async function markCandidatePromoted(
  tx: Prisma.TransactionClient,
  candidate: { id: string; status: CandidateStatus },
  data: Pick<Prisma.CandidateUpdateManyMutationInput, 'promotedTo' | 'promotedSkillId' | 'promotedAppId'>,
) {
  const result = await tx.candidate.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
    },
    data: {
      status: CandidateStatus.promoted,
      ...data,
    },
  })
  if (result.count !== 1) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }

  const updatedCandidate = await tx.candidate.findUnique({ where: { id: candidate.id } })
  if (!updatedCandidate) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  return mapCandidate(updatedCandidate)
}

export async function countActiveCandidates() {
  return prisma.candidate.count({
    where: { status: { in: [CandidateStatus.watching, CandidateStatus.evaluating] } },
  })
}
