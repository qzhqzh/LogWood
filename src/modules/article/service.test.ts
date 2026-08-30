import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ArticleContributionKind,
  ArticleReviewStatus,
  ArticleSourceKind,
  ArticleStatus,
} from '@prisma/client'

const prismaMock = vi.hoisted(() => {
  const tx = {
    article: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    articleVersion: { create: vi.fn() },
    articleContribution: { create: vi.fn() },
    articleSource: { createMany: vi.fn() },
  }
  return {
    tx,
    article: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    articleSource: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/modules/like', () => ({
  assessContent: vi.fn(() => ({ flagged: false })),
}))

import {
  createArticle,
  listArticles,
  reviewArticle,
  updateArticle,
} from './service'

describe('article/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates version, contribution and source records while keeping the article in draft', async () => {
    prismaMock.article.findUnique.mockResolvedValue(null)
    prismaMock.tx.article.create.mockResolvedValue({
      id: 'a1',
      title: 'Agent 实践复盘',
      excerpt: '协作摘要',
      content: '<p>协作内容</p>',
      tags: '["Agent"]',
      coverImageUrl: null,
    })
    prismaMock.tx.articleVersion.create.mockResolvedValue({ id: 'v1' })
    prismaMock.tx.article.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      slug: 'agent-实践复盘',
      status: ArticleStatus.draft,
      reviewStatus: ArticleReviewStatus.pending,
      currentVersion: 1,
    })
    const generatedAt = new Date('2026-07-29T11:55:00.000Z')

    const result = await createArticle({
      title: 'Agent 实践复盘',
      excerpt: '协作摘要',
      content: '<p>协作内容</p>',
      status: ArticleStatus.published,
      tags: ['Agent', 'Agent'],
      sources: [{
        kind: ArticleSourceKind.inspiration,
        label: '原始灵感',
        candidateId: 'candidate-1',
      }],
      aiAttribution: {
        provider: 'DeepSeek',
        model: 'deepseek-v4-pro',
        modelVersion: '2026-07',
        generatedAt,
      },
    }, 'user-1')

    expect(prismaMock.tx.article.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: ArticleStatus.draft,
        reviewStatus: ArticleReviewStatus.pending,
        currentVersion: 1,
        approvedVersion: null,
        tags: '["Agent"]',
        aiProvider: 'DeepSeek',
      }),
    })
    expect(prismaMock.tx.articleVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ articleId: 'a1', version: 1 }),
    })
    expect(prismaMock.tx.articleContribution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        articleId: 'a1',
        articleVersionId: 'v1',
        kind: ArticleContributionKind.ai,
      }),
    })
    expect(prismaMock.tx.articleSource.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        articleId: 'a1',
        candidateId: 'candidate-1',
      })],
    })
    expect(result.status).toBe(ArticleStatus.draft)
  })

  it('rejects direct human publication before creating a record', async () => {
    prismaMock.article.findUnique.mockResolvedValue(null)
    await expect(createArticle({
      title: '人工稿',
      content: '这是一篇尚未审核的人工内容。',
      status: ArticleStatus.published,
    }, 'user-1')).rejects.toThrow('ERR_ARTICLE_REVIEW_REQUIRED')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('invalidates approval and creates a new version after content changes', async () => {
    prismaMock.article.findUnique.mockResolvedValue({
      id: 'a1',
      title: '已发布文章',
      excerpt: null,
      content: '<p>旧内容</p>',
      tags: '[]',
      coverImageUrl: null,
      status: ArticleStatus.published,
      reviewStatus: ArticleReviewStatus.approved,
      currentVersion: 2,
      approvedVersion: 2,
      publishedAt: new Date('2026-08-01T00:00:00Z'),
    })
    prismaMock.tx.article.update.mockResolvedValue({
      id: 'a1',
      title: '已发布文章',
      excerpt: null,
      content: '<p>新内容</p>',
      tags: '[]',
      coverImageUrl: null,
    })
    prismaMock.tx.articleVersion.create.mockResolvedValue({ id: 'v3' })
    prismaMock.tx.article.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      status: ArticleStatus.draft,
      reviewStatus: ArticleReviewStatus.pending,
      currentVersion: 3,
      approvedVersion: null,
    })

    await updateArticle('a1', {
      content: '<p>新内容</p>',
      changeSummary: '补充验证结果',
    }, 'editor-1')

    expect(prismaMock.tx.article.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ArticleStatus.draft,
        reviewStatus: ArticleReviewStatus.pending,
        currentVersion: 3,
        approvedVersion: null,
        reviewerUserId: null,
      }),
    }))
    expect(prismaMock.tx.articleVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 3, changeSummary: '补充验证结果' }),
    })
  })

  it('approves exactly the current version without publishing it', async () => {
    prismaMock.article.findUnique.mockResolvedValue({
      id: 'a1',
      currentVersion: 4,
      reviewRequestedAt: new Date('2026-08-10T00:00:00Z'),
    })
    prismaMock.article.update.mockResolvedValue({
      id: 'a1',
      status: ArticleStatus.draft,
      reviewStatus: ArticleReviewStatus.approved,
      currentVersion: 4,
      approvedVersion: 4,
    })

    await reviewArticle({ id: 'a1', reviewerUserId: 'reviewer-1', action: 'approve' })

    expect(prismaMock.article.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ArticleStatus.draft,
        reviewStatus: ArticleReviewStatus.approved,
        reviewerUserId: 'reviewer-1',
        approvedVersion: 4,
      }),
    }))
  })

  it('lists published articles by default', async () => {
    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.article.count.mockResolvedValue(0)

    const result = await listArticles({})

    expect(prismaMock.article.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: ArticleStatus.published },
    }))
    expect(result.total).toBe(0)
  })
})
