import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://logwood.app'

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/editor`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/coding`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/articles`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/app`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/tags`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/emojis`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/submit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]

  const [targets, articles, apps] = await Promise.all([
    prisma.target.findMany({
      select: { slug: true, type: true, createdAt: true },
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
    url: `${baseUrl}/${t.type}/${t.slug}`,
    lastModified: t.createdAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${baseUrl}/articles/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const appRoutes: MetadataRoute.Sitemap = apps.map((a) => ({
    url: `${baseUrl}/app/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...targetRoutes, ...articleRoutes, ...appRoutes]
}
