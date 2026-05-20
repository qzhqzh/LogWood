import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { canonicalFor } from '@/shared/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Public, indexable static routes only. Low-value routes (`/submit`,
  // `/emojis`, `/tags`) are excluded here and disallowed in robots.ts.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalFor('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: canonicalFor('/editor'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalFor('/coding'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalFor('/articles'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: canonicalFor('/app'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ]

  const [targets, articles, apps] = await Promise.all([
    prisma.target.findMany({
      select: {
        slug: true,
        type: true,
        createdAt: true,
        // Workaround for missing Target.updatedAt: use latest published review
        // updatedAt as a proxy for "content freshness" of the target page.
        reviews: {
          select: { updatedAt: true },
          where: { status: 'published' },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.article.findMany({
      select: { slug: true, updatedAt: true },
      where: { status: 'published' },
    }),
    prisma.app.findMany({
      select: { slug: true, updatedAt: true },
      where: { status: 'published' },
    }),
  ])

  const targetRoutes: MetadataRoute.Sitemap = targets.map((t) => ({
    url: canonicalFor(`/${t.type}/${t.slug}`),
    lastModified: t.reviews[0]?.updatedAt ?? t.createdAt,
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

  return [...staticRoutes, ...targetRoutes, ...articleRoutes, ...appRoutes]
}
