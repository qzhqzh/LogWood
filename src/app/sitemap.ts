import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { canonicalFor } from '@/shared/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Public, indexable static routes only. Low-value routes (`/submit`,
  // `/emojis`, `/tags`) are excluded here and disallowed in robots.ts.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalFor('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: canonicalFor('/skills'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalFor('/candidates'), lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: canonicalFor('/tools'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: canonicalFor('/app'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: canonicalFor('/forge'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: canonicalFor('/compare'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: canonicalFor('/articles'), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
  ]

  // Target now exposes its own @updatedAt (Phase 2 of security hardening),
  // so we no longer need to derive freshness from the latest review.
  const [targets, articles, apps, candidates] = await Promise.all([
    prisma.target.findMany({
      select: { slug: true, type: true, updatedAt: true },
    }),
    prisma.article.findMany({
      select: { slug: true, updatedAt: true },
      where: { status: 'published' },
    }),
    prisma.app.findMany({
      select: { slug: true, updatedAt: true },
      where: { status: 'published' },
    }),
    prisma.candidate.findMany({
      select: { slug: true, updatedAt: true },
      where: { status: { in: ['watching', 'evaluating', 'promoted'] } },
    }),
  ])

  const targetRoutes: MetadataRoute.Sitemap = targets.map((t) => ({
    url: canonicalFor(`/${t.type}/${t.slug}`),
    lastModified: t.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: canonicalFor(`/articles/${a.slug}`),
    lastModified: a.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const appRoutes: MetadataRoute.Sitemap = apps.map((a) => ({
    url: canonicalFor(`/app/${a.slug}`),
    lastModified: a.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const candidateRoutes: MetadataRoute.Sitemap = candidates.map((c) => ({
    url: canonicalFor(`/candidates/${c.slug}`),
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.75,
  }))

  return [...staticRoutes, ...targetRoutes, ...articleRoutes, ...appRoutes, ...candidateRoutes]
}
