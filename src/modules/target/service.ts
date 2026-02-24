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

function parseFeatures(features: string): string[] {
  try {
    return JSON.parse(features)
  } catch {
    return []
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
