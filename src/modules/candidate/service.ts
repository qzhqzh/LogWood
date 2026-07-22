import { prisma } from '@/lib/prisma'
import {
  CandidatePromoteTo,
  CandidateStatus,
  TargetType,
} from '@prisma/client'
import { createTarget } from '@/modules/target'
import { createApp } from '@/modules/app'
import { candidateStatusLabel } from './constants'

export {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  candidateStatusLabel,
} from './constants'


export interface CreateCandidateInput {
  title: string
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
  to: 'tool' | 'gallery'
  /** Required when promoting to tool */
  targetType?: TargetType
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

function mapCandidate<T extends { tags: string }>(candidate: T) {
  return {
    ...candidate,
    tags: parseTags(candidate.tags),
  }
}

export async function listCandidates(opts?: { status?: CandidateStatus; includePromoted?: boolean }) {
  const where: { status?: CandidateStatus | { in: CandidateStatus[] } } = {}
  if (opts?.status) {
    where.status = opts.status
  } else if (!opts?.includePromoted) {
    where.status = { in: [CandidateStatus.watching, CandidateStatus.evaluating] }
  }

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
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

export async function createCandidate(input: CreateCandidateInput, authorUserId?: string) {
  const slug = await ensureUniqueSlug(slugify(input.title))
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
  if (input.title.trim() !== existing.title) {
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

  if (input.to === 'tool') {
    const targetType = input.targetType || TargetType.coding
    const target = await createTarget({
      name: candidate.title,
      type: targetType,
      logoUrl: candidate.logoUrl || undefined,
      description: candidate.summary || undefined,
      websiteUrl: candidate.websiteUrl || undefined,
      previewImageUrl: candidate.previewImageUrl || undefined,
      sourceUrl: candidate.sourceUrl || undefined,
      features: parseTags(candidate.tags),
    })

    return prisma.candidate
      .update({
        where: { id: candidate.id },
        data: {
          status: CandidateStatus.promoted,
          promotedTo: CandidatePromoteTo.tool,
          promotedTargetId: target.id,
        },
      })
      .then((c) => ({
        candidate: mapCandidate(c),
        promoted: { type: 'tool' as const, id: target.id, slug: target.slug },
      }))
  }

  const appUrl = candidate.websiteUrl || candidate.sourceUrl || 'https://example.com'
  const app = await createApp({
    name: candidate.title,
    appUrl,
    title: candidate.title,
    summary: candidate.summary || candidate.title,
    description: candidate.summary || candidate.title,
    previewImageUrl: candidate.previewImageUrl || undefined,
    tags: parseTags(candidate.tags),
    status: 'published',
  })

  return prisma.candidate
    .update({
      where: { id: candidate.id },
      data: {
        status: CandidateStatus.promoted,
        promotedTo: CandidatePromoteTo.gallery,
        promotedAppId: app.id,
      },
    })
    .then((c) => ({
      candidate: mapCandidate(c),
      promoted: { type: 'gallery' as const, id: app.id, slug: app.slug },
    }))
}

export async function countActiveCandidates() {
  return prisma.candidate.count({
    where: { status: { in: [CandidateStatus.watching, CandidateStatus.evaluating] } },
  })
}
