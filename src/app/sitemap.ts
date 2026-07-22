import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { canonicalFor } from '@/shared/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Public, indexable static routes only. Low-value routes (`/submit`,
  // `/emojis`, `/tags`) are excluded here and disallowed in robots.ts.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalFor('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: canonicalFor('/candidates'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalFor('/skills'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalFor('/talk'), lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: canonicalFor('/articles'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: canonicalFor('/tools'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: canonicalFor('/app'), lastModified: now, changeFrequency: 'weekly', priority: 0.65 },
    { url: canonicalFor('/forge'), lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: canonicalFor('/compare'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ]

  const [targets, articles, apps, candidates, skills] = await Promise.all([
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
    prisma.skill.findMany({
      select: { slug: true, updatedAt: true },
      where: { status: 'published' },
    }),
  ])

  const targetRoutes: MetadataRoute.Sitemap = targets.map((target) => ({
    url: canonicalFor(`/${target.type}/${target.slug}`),
    lastModified: target.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.75,
  }))

  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: canonicalFor(`/articles/${article.slug}`),
    lastModified: article.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const appRoutes: MetadataRoute.Sitemap = apps.map((app) => ({
    url: canonicalFor(`/app/${app.slug}`),
    lastModified: app.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const candidateRoutes: MetadataRoute.Sitemap = candidates.map((candidate) => ({
    url: canonicalFor(`/candidates/${candidate.slug}`),
    lastModified: candidate.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.75,
  }))

  const skillRoutes: MetadataRoute.Sitemap = skills.map((skill) => ({
    url: canonicalFor(`/skills/${skill.slug}`),
    lastModified: skill.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.85,
  }))

  return [
    ...staticRoutes,
    ...skillRoutes,
    ...candidateRoutes,
    ...targetRoutes,
    ...articleRoutes,
    ...appRoutes,
  ]
}
