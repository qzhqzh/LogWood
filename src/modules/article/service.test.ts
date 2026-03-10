import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    article: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { createArticle, listArticles, updateArticle } from './service'
import { ArticleStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const prismaMock = prisma as unknown as {
  article: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}

describe('article/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates article with unique slug suffix when collision exists', async () => {
    prismaMock.article.findUnique
      .mockResolvedValueOnce({ id: 'existing-id', slug: 'hello-world' })
      .mockResolvedValueOnce(null)

    prismaMock.article.create.mockResolvedValue({
      id: 'a1',
      title: 'Hello World',
      slug: 'hello-world-2',
      status: ArticleStatus.draft,
      publishedAt: null,
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
    })

    const result = await createArticle(
      {
        title: 'Hello World',
        content: 'This is a test article body with enough content for validation.',
      },
      'user-1'
    )

    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'hello-world-2',
          authorUserId: 'user-1',
        }),
      })
    )
    expect(result.slug).toBe('hello-world-2')
  })

  it('updates publishedAt when moving from draft to published', async () => {
    prismaMock.article.findUnique
      .mockResolvedValueOnce({
        id: 'a1',
        title: 'Draft title',
        status: ArticleStatus.draft,
        publishedAt: null,
      })
      .mockResolvedValueOnce(null)

    prismaMock.article.update.mockResolvedValue({
      id: 'a1',
      title: 'Published title',
      slug: 'published-title',
      status: ArticleStatus.published,
      publishedAt: new Date('2026-03-10T00:00:00.000Z'),
      updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    })

    await updateArticle('a1', {
      title: 'Published title',
      status: ArticleStatus.published,
    })

    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ArticleStatus.published,
          publishedAt: expect.any(Date),
          slug: 'published-title',
        }),
      })
    )
  })

  it('lists published articles by default', async () => {
    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.article.count.mockResolvedValue(0)

    const result = await listArticles({})

    expect(prismaMock.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ArticleStatus.published },
      })
    )
    expect(result.total).toBe(0)
  })
})
