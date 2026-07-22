import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    target: { findMany: vi.fn() },
    article: { findMany: vi.fn() },
    app: { findMany: vi.fn() },
    candidate: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import sitemap from './sitemap'

const prismaMock = prisma as unknown as {
  target: { findMany: ReturnType<typeof vi.fn> }
  article: { findMany: ReturnType<typeof vi.fn> }
  app: { findMany: ReturnType<typeof vi.fn> }
  candidate: { findMany: ReturnType<typeof vi.fn> }
}

const ORIGINAL_SITE_URL = process.env.SITE_URL

describe('app/sitemap', () => {
  beforeEach(() => {
    process.env.SITE_URL = 'https://logwood.test'
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = ORIGINAL_SITE_URL
  })

  it('includes only public static routes (no /submit, /emojis, /tags)', async () => {
    prismaMock.target.findMany.mockResolvedValue([])
    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.app.findMany.mockResolvedValue([])
    prismaMock.candidate.findMany.mockResolvedValue([])

    const result = await sitemap()
    const urls = result.map((entry) => entry.url)

    expect(urls).toContain('https://logwood.test')
    expect(urls).toContain('https://logwood.test/skills')
    expect(urls).toContain('https://logwood.test/candidates')
    expect(urls).toContain('https://logwood.test/forge')
    expect(urls).toContain('https://logwood.test/compare')
    expect(urls).toContain('https://logwood.test/articles')
    expect(urls).toContain('https://logwood.test/app')

    for (const blocked of ['/submit', '/emojis', '/tags', '/editor', '/coding']) {
      expect(urls.some((u) => u.endsWith(blocked))).toBe(false)
    }
  })

  it('uses Target.updatedAt as the canonical sitemap lastmod', async () => {
    const updatedAt = new Date('2026-04-10T00:00:00Z')
    prismaMock.target.findMany.mockResolvedValue([
      { slug: 'cursor', type: 'editor', updatedAt },
    ])
    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.app.findMany.mockResolvedValue([])
    prismaMock.candidate.findMany.mockResolvedValue([])

    const result = await sitemap()
    const cursorEntry = result.find((e) => e.url === 'https://logwood.test/editor/cursor')
    expect(cursorEntry?.lastModified).toEqual(updatedAt)
  })

  it('queries targets with updatedAt select and no reviews join', async () => {
    prismaMock.target.findMany.mockResolvedValue([])
    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.app.findMany.mockResolvedValue([])
    prismaMock.candidate.findMany.mockResolvedValue([])

    await sitemap()

    expect(prismaMock.target.findMany).toHaveBeenCalledWith({
      select: { slug: true, type: true, updatedAt: true },
    })
  })

  it('includes article and app routes with absolute URLs', async () => {
    prismaMock.target.findMany.mockResolvedValue([])
    prismaMock.article.findMany.mockResolvedValue([
      { slug: 'hello-world', updatedAt: new Date('2026-03-01T00:00:00Z') },
    ])
    prismaMock.app.findMany.mockResolvedValue([
      { slug: 'taskbox', updatedAt: new Date('2026-03-02T00:00:00Z') },
    ])
    prismaMock.candidate.findMany.mockResolvedValue([])

    const result = await sitemap()
    const urls = result.map((e) => e.url)

    expect(urls).toContain('https://logwood.test/articles/hello-world')
    expect(urls).toContain('https://logwood.test/app/taskbox')
  })
})
