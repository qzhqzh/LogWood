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

  const targets = await prisma.target.findMany({
    where,
    include: {
      _count: {
        select: { reviews: { where: { status: 'published' } } },
      },
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return targets.map((target) => {
    const ratings = target.reviews.map((r) => r.rating)
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null

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
      _count: target._count,
      avgRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
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
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
  })

  if (!target) return null

  const ratings = target.reviews.map((r) => r.rating)
  const avgRating = ratings.length > 0
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null

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
    _count: target._count,
    avgRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
  }
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
