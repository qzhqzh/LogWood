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

vi.mock('@/modules/like', () => ({
  assessContent: vi.fn(() => ({ flagged: false })),
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

  it('records complete AI attribution for an AI-authored article', async () => {
    prismaMock.article.findUnique.mockResolvedValue(null)
    prismaMock.article.create.mockResolvedValue({
      id: 'a1',
      title: 'Agent 实践复盘',
      slug: 'agent-实践复盘',
      status: ArticleStatus.draft,
      publishedAt: null,
      createdAt: new Date('2026-07-29T12:00:00.000Z'),
    })
    const generatedAt = new Date('2026-07-29T11:55:00.000Z')

    await createArticle({
      title: 'Agent 实践复盘',
      content: '这是一篇由 Agent 整理并提交的经验文章，包含足够完整的实践上下文。',
      aiAttribution: {
        provider: 'OpenAI',
        model: 'gpt-5.4',
        modelVersion: '2026-06-01',
        generatedAt,
      },
    }, 'user-1')

    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiProvider: 'OpenAI',
          aiModel: 'gpt-5.4',
          aiModelVersion: '2026-06-01',
          aiGeneratedAt: generatedAt,
        }),
      }),
    )
  })

  it('keeps flagged AI content as a draft', async () => {
    const { assessContent } = await import('@/modules/like')
    vi.mocked(assessContent).mockReturnValueOnce({
      flagged: true,
      reason: 'sensitive_word',
    })
    prismaMock.article.findUnique.mockResolvedValue(null)
    prismaMock.article.create.mockResolvedValue({
      id: 'a1',
      title: 'Agent 文章',
      slug: 'agent-文章',
      status: ArticleStatus.draft,
      publishedAt: null,
      createdAt: new Date('2026-07-29T12:00:00.000Z'),
    })

    await createArticle({
      title: 'Agent 文章',
      content: '这是一篇由 Agent 整理并提交的经验文章，包含足够完整的实践上下文。',
      status: ArticleStatus.published,
      aiAttribution: {
        provider: 'OpenAI',
        model: 'gpt-5.4',
        modelVersion: '2026-06-01',
      },
    }, 'user-1')

    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ArticleStatus.draft,
          publishedAt: null,
        }),
      }),
    )
  })
})
