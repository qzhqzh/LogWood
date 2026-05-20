import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    target: { findMany: vi.fn() },
    article: { findMany: vi.fn() },
    app: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import sitemap from './sitemap'

const prismaMock = prisma as unknown as {
  target: { findMany: ReturnType<typeof vi.fn> }
  article: { findMany: ReturnType<typeof vi.fn> }
  app: { findMany: ReturnType<typeof vi.fn> }
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

    const result = await sitemap()
    const urls = result.map((entry) => entry.url)

    expect(urls).toContain('https://logwood.test')
    expect(urls).toContain('https://logwood.test/editor')
    expect(urls).toContain('https://logwood.test/coding')
    expect(urls).toContain('https://logwood.test/articles')
    expect(urls).toContain('https://logwood.test/app')

    for (const blocked of ['/submit', '/emojis', '/tags']) {
      expect(urls.some((u) => u.endsWith(blocked))).toBe(false)
    }
  })

  it('uses latest published review.updatedAt as target lastModified, falling back to createdAt', async () => {
    const reviewDate = new Date('2026-04-10T00:00:00Z')
    const createdAt = new Date('2026-01-01T00:00:00Z')
    prismaMock.target.findMany.mockResolvedValue([
      {
        slug: 'cursor',
        type: 'editor',
        createdAt,
        reviews: [{ updatedAt: reviewDate }],
      },
      {
        slug: 'no-reviews',
        type: 'coding',
        createdAt,
        reviews: [],
      },
    ])
    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.app.findMany.mockResolvedValue([])

    const result = await sitemap()

    const cursorEntry = result.find((e) => e.url === 'https://logwood.test/editor/cursor')
    const fallbackEntry = result.find((e) => e.url === 'https://logwood.test/coding/no-reviews')

    expect(cursorEntry?.lastModified).toEqual(reviewDate)
    expect(fallbackEntry?.lastModified).toEqual(createdAt)
  })

  it('queries targets with the published-review filter and orderBy desc', async () => {
    prismaMock.target.findMany.mockResolvedValue([])
    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.app.findMany.mockResolvedValue([])

    await sitemap()

    expect(prismaMock.target.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          reviews: expect.objectContaining({
            where: { status: 'published' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          }),
        }),
      }),
    )
  })

  it('includes article and app routes with absolute URLs', async () => {
    prismaMock.target.findMany.mockResolvedValue([])
    prismaMock.article.findMany.mockResolvedValue([
      { slug: 'hello-world', updatedAt: new Date('2026-03-01T00:00:00Z') },
    ])
    prismaMock.app.findMany.mockResolvedValue([
      { slug: 'taskbox', updatedAt: new Date('2026-03-02T00:00:00Z') },
    ])

    const result = await sitemap()
    const urls = result.map((e) => e.url)

    expect(urls).toContain('https://logwood.test/articles/hello-world')
    expect(urls).toContain('https://logwood.test/app/taskbox')
  })
})
