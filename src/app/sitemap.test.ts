import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    target: { findMany: vi.fn() },
    article: { findMany: vi.fn() },
    app: { findMany: vi.fn() },
    candidate: { findMany: vi.fn() },
    skill: { findMany: vi.fn() },
    evaluation: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import sitemap from './sitemap'

const prismaMock = prisma as unknown as {
  target: { findMany: ReturnType<typeof vi.fn> }
  article: { findMany: ReturnType<typeof vi.fn> }
  app: { findMany: ReturnType<typeof vi.fn> }
  candidate: { findMany: ReturnType<typeof vi.fn> }
  skill: { findMany: ReturnType<typeof vi.fn> }
  evaluation: { findMany: ReturnType<typeof vi.fn> }
}

const ORIGINAL_SITE_URL = process.env.SITE_URL

function mockEmptyCollections() {
  prismaMock.target.findMany.mockResolvedValue([])
  prismaMock.article.findMany.mockResolvedValue([])
  prismaMock.app.findMany.mockResolvedValue([])
  prismaMock.candidate.findMany.mockResolvedValue([])
  prismaMock.skill.findMany.mockResolvedValue([])
  prismaMock.evaluation.findMany.mockResolvedValue([])
}

describe('app/sitemap', () => {
  beforeEach(() => {
    process.env.SITE_URL = 'https://logwood.test'
    vi.clearAllMocks()
    mockEmptyCollections()
  })

  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = ORIGINAL_SITE_URL
  })

  it('includes public lifecycle routes and excludes low-value legacy entries', async () => {
    const result = await sitemap()
    const urls = result.map((entry) => entry.url)

    expect(urls).toContain('https://logwood.test')
    expect(urls).toContain('https://logwood.test/candidates')
    expect(urls).toContain('https://logwood.test/skills')
    expect(urls).toContain('https://logwood.test/evaluations')
    expect(urls).toContain('https://logwood.test/talk')
    expect(urls).toContain('https://logwood.test/articles')
    expect(urls).toContain('https://logwood.test/forge')
    expect(urls).toContain('https://logwood.test/compare')
    expect(urls).toContain('https://logwood.test/app')

    for (const blocked of ['/submit', '/emojis', '/tags', '/editor', '/coding']) {
      expect(urls.some((url) => url.endsWith(blocked))).toBe(false)
    }
  })

  it('uses Target.updatedAt as the canonical sitemap lastmod', async () => {
    const updatedAt = new Date('2026-04-10T00:00:00Z')
    prismaMock.target.findMany.mockResolvedValue([
      { slug: 'cursor', type: 'editor', updatedAt },
    ])

    const result = await sitemap()
    const cursorEntry = result.find((entry) => entry.url === 'https://logwood.test/editor/cursor')
    expect(cursorEntry?.lastModified).toEqual(updatedAt)
  })

  it('queries public content freshness without loading Review relations', async () => {
    await sitemap()

    expect(prismaMock.target.findMany).toHaveBeenCalledWith({
      select: { slug: true, type: true, updatedAt: true },
    })
    expect(prismaMock.skill.findMany).toHaveBeenCalledWith({
      select: { slug: true, updatedAt: true },
      where: { status: 'published' },
    })
    expect(prismaMock.evaluation.findMany).toHaveBeenCalledWith({
      select: { id: true, updatedAt: true },
      where: { status: 'published' },
    })
  })

  it('includes published Evaluation, Skill, article, app and candidate details', async () => {
    prismaMock.evaluation.findMany.mockResolvedValue([
      { id: 'evaluation-1', updatedAt: new Date('2026-03-05T00:00:00Z') },
    ])
    prismaMock.skill.findMany.mockResolvedValue([
      { slug: 'review-skill', updatedAt: new Date('2026-03-03T00:00:00Z') },
    ])
    prismaMock.article.findMany.mockResolvedValue([
      { slug: 'hello-world', updatedAt: new Date('2026-03-01T00:00:00Z') },
    ])
    prismaMock.app.findMany.mockResolvedValue([
      { slug: 'taskbox', updatedAt: new Date('2026-03-02T00:00:00Z') },
    ])
    prismaMock.candidate.findMany.mockResolvedValue([
      { slug: 'new-model', updatedAt: new Date('2026-03-04T00:00:00Z') },
    ])

    const result = await sitemap()
    const urls = result.map((entry) => entry.url)

    expect(urls).toContain('https://logwood.test/evaluations/evaluation-1')
    expect(urls).toContain('https://logwood.test/skills/review-skill')
    expect(urls).toContain('https://logwood.test/articles/hello-world')
    expect(urls).toContain('https://logwood.test/app/taskbox')
    expect(urls).toContain('https://logwood.test/candidates/new-model')
  })
})
