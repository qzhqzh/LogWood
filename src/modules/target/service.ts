import { prisma } from '@/lib/prisma'
import { TargetType } from '@prisma/client'

export interface TargetFilter {
  type?: TargetType
  feature?: string
}

export interface TargetWithStats {
  id: string
  name: string
  slug: string
  type: TargetType
  logoUrl: string | null
  description: string | null
  websiteUrl: string | null
  developer: string | null
  features: string[]
  previewImageUrl: string | null
  sourceUrl: string | null
  compareGroup: string | null
  _count?: {
    reviews: number
  }
  avgRating?: number
}

export interface CreateTargetInput {
  name: string
  type: TargetType
  logoUrl?: string
  description?: string
  websiteUrl?: string
  developer?: string
  features?: string[]
  previewImageUrl?: string
  sourceUrl?: string
  compareGroup?: string
}

export interface UpdateTargetInput {
  id: string
  name: string
  type: TargetType
  logoUrl?: string
  description?: string
  websiteUrl?: string
  developer?: string
  features?: string[]
  previewImageUrl?: string
  sourceUrl?: string
  compareGroup?: string
}

function parseFeatures(features: string): string[] {
  try {
    return JSON.parse(features)
  } catch {
    return []
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `target-${Date.now()}`
}

async function ensureUniqueTargetSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let suffix = 1

  while (true) {
    const existing = await prisma.target.findUnique({ where: { slug } })
    if (!existing) return slug
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }
}

export async function listTargets(filter?: TargetFilter): Promise<TargetWithStats[]> {
  const where: any = {}

  if (filter?.type) {
    where.type = filter.type
  }

  // Load only target metadata + a published-review count. Average rating is
  // computed from a separate `groupBy` aggregate so we never pull the full
  // ratings list into memory (R-hot path: a target with 10k reviews used to
  // load all rows just to compute the mean).
  const targets = await prisma.target.findMany({
    where,
    include: {
      _count: {
        select: { reviews: { where: { status: 'published' } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const targetIds = targets.map((t) => t.id)
  const ratingByTarget = new Map<string, number>()

  if (targetIds.length > 0) {
    const groups = await prisma.review.groupBy({
      by: ['targetId'],
      where: { targetId: { in: targetIds }, status: 'published' },
      _avg: { rating: true },
    })
    for (const group of groups) {
      if (typeof group._avg.rating === 'number') {
        ratingByTarget.set(group.targetId, Math.round(group._avg.rating * 10) / 10)
      }
    }
  }

  return targets.map((target) => {
    const avgRating = ratingByTarget.get(target.id)

    return {
      id: target.id,
      name: target.name,
      slug: target.slug,
      type: target.type,
      logoUrl: target.logoUrl,
      description: target.description,
      websiteUrl: target.websiteUrl,
      developer: target.developer,
      features: parseFeatures(target.features),
      previewImageUrl: target.previewImageUrl,
      sourceUrl: target.sourceUrl,
      compareGroup: target.compareGroup,
      _count: target._count,
      avgRating: avgRating ?? undefined,
    }
  })
}

export async function createTarget(input: CreateTargetInput) {
  const baseSlug = slugify(input.name)
  const slug = await ensureUniqueTargetSlug(baseSlug)

  return prisma.target.create({
    data: {
      name: input.name,
      slug,
      type: input.type,
      logoUrl: input.logoUrl || null,
      description: input.description || null,
      websiteUrl: input.websiteUrl || null,
      developer: input.developer || null,
      features: JSON.stringify(input.features || []),
      previewImageUrl: input.previewImageUrl || null,
      sourceUrl: input.sourceUrl || null,
      compareGroup: input.compareGroup?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
    },
  })
}

export async function updateTarget(input: UpdateTargetInput) {
  const existing = await prisma.target.findUnique({
    where: { id: input.id },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('ERR_TARGET_NOT_FOUND')
  }

  return prisma.target.update({
    where: { id: input.id },
    data: {
      name: input.name,
      type: input.type,
      logoUrl: input.logoUrl || null,
      description: input.description || null,
      websiteUrl: input.websiteUrl || null,
      developer: input.developer || null,
      features: JSON.stringify(input.features || []),
      previewImageUrl: input.previewImageUrl || null,
      sourceUrl: input.sourceUrl || null,
      compareGroup: input.compareGroup?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
    },
  })
}

export async function deleteTarget(id: string) {
  const existing = await prisma.target.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('ERR_TARGET_NOT_FOUND')
  }

  return prisma.target.delete({
    where: { id },
    select: { id: true },
  })
}

export async function getTargetBySlug(
  type: TargetType,
  slug: string
): Promise<TargetWithStats | null> {
  const target = await prisma.target.findFirst({
    where: { type, slug },
    include: {
      _count: {
        select: { reviews: { where: { status: 'published' } } },
      },
    },
  })

  if (!target) return null

  // Single-target avg via aggregate; avoids loading every review row.
  const ratingAgg = await prisma.review.aggregate({
    where: { targetId: target.id, status: 'published' },
    _avg: { rating: true },
  })

  const avgRating = typeof ratingAgg._avg.rating === 'number'
    ? Math.round(ratingAgg._avg.rating * 10) / 10
    : undefined

  return {
    id: target.id,
    name: target.name,
    slug: target.slug,
    type: target.type,
    logoUrl: target.logoUrl,
    description: target.description,
    websiteUrl: target.websiteUrl,
    developer: target.developer,
    features: parseFeatures(target.features),
    previewImageUrl: target.previewImageUrl,
    sourceUrl: target.sourceUrl,
    compareGroup: target.compareGroup,
    _count: target._count,
    avgRating,
  }
}

export async function getTargetsByIds(ids: string[]): Promise<TargetCompareCard[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 4)
  if (uniqueIds.length === 0) return []

  const targets = await prisma.target.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      _count: {
        select: { reviews: { where: { status: 'published' } } },
      },
      reviews: {
        where: { status: 'published' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          content: true,
          rating: true,
          createdAt: true,
          user: { select: { name: true } },
          anonymousUser: { select: { displayName: true } },
        },
      },
    },
  })

  const ratingByTarget = new Map<string, number>()
  const groups = await prisma.review.groupBy({
    by: ['targetId'],
    where: { targetId: { in: uniqueIds }, status: 'published' },
    _avg: { rating: true },
  })
  for (const group of groups) {
    if (typeof group._avg.rating === 'number') {
      ratingByTarget.set(group.targetId, Math.round(group._avg.rating * 10) / 10)
    }
  }

  const byId = new Map(targets.map((t) => [t.id, t]))
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((target) => ({
      id: target.id,
      name: target.name,
      slug: target.slug,
      type: target.type,
      logoUrl: target.logoUrl,
      description: target.description,
      websiteUrl: target.websiteUrl,
      developer: target.developer,
      features: parseFeatures(target.features),
      previewImageUrl: target.previewImageUrl,
      sourceUrl: target.sourceUrl,
      compareGroup: target.compareGroup,
      _count: target._count,
      avgRating: ratingByTarget.get(target.id),
      recentReviews: target.reviews.map((review) => ({
        id: review.id,
        content: review.content,
        rating: review.rating,
        createdAt: review.createdAt,
        authorName: review.user?.name || review.anonymousUser?.displayName || '匿名',
      })),
    }))
}

export type TargetCompareCard = TargetWithStats & {
  recentReviews: Array<{
    id: string
    content: string
    rating: number
    createdAt: Date
    authorName: string
  }>
}

export async function listTargetsByCompareGroup(compareGroup: string): Promise<TargetWithStats[]> {
  const trimmed = compareGroup.trim()
  if (!trimmed) return []
  const all = await listTargets()
  return all.filter((t) => t.compareGroup === trimmed)
}

export async function getTargetById(id: string) {
  return prisma.target.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
    },
  })
}

export async function getFeatures(): Promise<string[]> {
  const targets = await prisma.target.findMany({
    select: { features: true },
  })

  const featureSet = new Set<string>()
  targets.forEach((t) => {
    const features = parseFeatures(t.features)
    features.forEach((f) => featureSet.add(f))
  })

  return Array.from(featureSet).sort()
}
