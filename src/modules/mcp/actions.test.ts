import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ArticleStatus, CandidateStatus, SkillStatus } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  candidate: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  target: { findUnique: vi.fn() },
  skill: { findUnique: vi.fn() },
  app: { findUnique: vi.fn() },
  articleColumn: { findUnique: vi.fn() },
}))
const candidateMocks = vi.hoisted(() => ({
  createCandidate: vi.fn(),
  findCandidateDuplicate: vi.fn(),
  listCandidates: vi.fn(),
  organizeCandidate: vi.fn(),
  promoteCandidate: vi.fn(),
}))
const createReviewMock = vi.hoisted(() => vi.fn())
const createArticleMock = vi.hoisted(() => vi.fn())
const approveAndPublishArticleMock = vi.hoisted(() => vi.fn())
const recordAdminActionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/modules/candidate', () => candidateMocks)
vi.mock('@/modules/review', () => ({ createReview: createReviewMock }))
vi.mock('@/modules/article', () => ({
  approveAndPublishArticle: approveAndPublishArticleMock,
  createArticle: createArticleMock,
}))
vi.mock('@/modules/audit', () => ({ recordAdminAction: recordAdminActionMock }))

import {
  confirmMcpArticlePublication,
  createMcpArticle,
  createMcpReview,
  listMcpInspirations,
  promoteMcpInspirationToApp,
  promoteMcpInspirationToSkill,
  recordMcpInspiration,
  updateMcpInspiration,
} from './actions'

describe('mcp/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recordAdminActionMock.mockResolvedValue(undefined)
  })

  it('records a text inspiration with a derived title and retry-safe key', async () => {
    candidateMocks.findCandidateDuplicate.mockResolvedValue(null)
    candidateMocks.createCandidate.mockResolvedValue({
      id: 'candidate-1',
      slug: '移动端截图归档',
      title: '移动端截图归档',
    })

    const result = await recordMcpInspiration({
      content: '移动端截图归档\n需要保留原图和标签。',
      tags: [' #移动端 ', '归档', '归档'],
    }, 'user-1')

    expect(candidateMocks.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '移动端截图归档',
        ideaKey: expect.stringMatching(/^mcp:/),
        summary: '移动端截图归档\n需要保留原图和标签。',
        rawContent: '移动端截图归档\n需要保留原图和标签。',
        tags: ['移动端', '归档'],
      }),
      'user-1',
    )
    expect(result.created).toBe(true)
  })

  it('records an archived article topic as private', async () => {
    candidateMocks.findCandidateDuplicate.mockResolvedValue(null)
    candidateMocks.createCandidate.mockResolvedValue({
      id: 'candidate-private',
      visibility: 'private',
    })

    await recordMcpInspiration({
      content: '归档一个待打磨的文章选题。',
      tags: ['article-topic'],
      visibility: 'private',
    }, 'user-1')

    expect(candidateMocks.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['article-topic'],
        visibility: 'private',
      }),
      'user-1',
    )
  })

  it('scopes search and updates to the MCP user', async () => {
    candidateMocks.listCandidates.mockResolvedValue([])
    await listMcpInspirations({
      search: '截图',
      status: CandidateStatus.watching,
    }, 'user-1')
    expect(candidateMocks.listCandidates).toHaveBeenCalledWith({
      search: '截图',
      status: CandidateStatus.watching,
      includePromoted: undefined,
      authorUserId: 'user-1',
      limit: 30,
    })

    prismaMock.candidate.findFirst.mockResolvedValue(null)
    await expect(updateMcpInspiration({
      candidateId: 'someone-else-candidate',
      tags: ['私有'],
    }, 'user-1')).rejects.toThrow('ERR_CANDIDATE_NOT_FOUND')
    expect(candidateMocks.organizeCandidate).not.toHaveBeenCalled()
  })

  it('rejects an empty inspiration update before touching storage', async () => {
    await expect(updateMcpInspiration({
      candidateId: 'candidate-1',
    }, 'user-1')).rejects.toThrow('ERR_MCP_UPDATE_REQUIRED')
    expect(prismaMock.candidate.findFirst).not.toHaveBeenCalled()
  })

  it('updates inspiration visibility without requiring tag changes', async () => {
    prismaMock.candidate.findFirst.mockResolvedValue({ id: 'candidate-1' })
    candidateMocks.organizeCandidate.mockResolvedValue({
      id: 'candidate-1',
      visibility: 'private',
    })

    await updateMcpInspiration({
      candidateId: 'candidate-1',
      visibility: 'private',
    }, 'user-1')

    expect(candidateMocks.organizeCandidate).toHaveBeenCalledWith({
      id: 'candidate-1',
      tags: undefined,
      status: undefined,
      visibility: 'private',
    })
  })

  it('passes a complete reusable Skill into the atomic promotion service', async () => {
    prismaMock.candidate.findFirst.mockResolvedValue({ id: 'candidate-1' })
    candidateMocks.promoteCandidate.mockResolvedValue({
      candidate: { id: 'candidate-1' },
      promoted: { type: 'skill', id: 'skill-1', slug: 'release-workflow' },
    })

    await promoteMcpInspirationToSkill({
      candidateId: 'candidate-1',
      title: '发布工作流',
      category: 'workflow',
      summary: '统一发布检查',
      prompt: '按顺序检查版本、测试、变更记录与回滚方案。',
      tags: ['发布', '流程'],
      status: SkillStatus.published,
    }, 'user-1')

    expect(candidateMocks.promoteCandidate).toHaveBeenCalledWith({
      id: 'candidate-1',
      to: 'skill',
      skill: expect.objectContaining({
        title: '发布工作流',
        category: 'workflow',
        prompt: '按顺序检查版本、测试、变更记录与回滚方案。',
        tags: ['发布', '流程'],
      }),
    })
  })

  it('promotes a pure image candidate to the gallery using candidate defaults', async () => {
    prismaMock.candidate.findFirst.mockResolvedValue({ id: 'candidate-1' })
    candidateMocks.promoteCandidate.mockResolvedValue({
      candidate: { id: 'candidate-1' },
      promoted: { type: 'gallery', id: 'app-1', slug: 'mobile-layout' },
    })

    await promoteMcpInspirationToApp({
      candidateId: 'candidate-1',
    }, 'user-1')

    expect(candidateMocks.promoteCandidate).toHaveBeenCalledWith({
      id: 'candidate-1',
      to: 'gallery',
      app: undefined,
    })
  })

  it('resolves a subject slug and records AI attribution on a review', async () => {
    prismaMock.skill.findUnique.mockResolvedValue({ id: 'skill-1' })
    createReviewMock.mockResolvedValue({
      id: 'review-1',
      status: 'published',
      createdAt: new Date('2026-07-29T12:00:00.000Z'),
    })
    const attribution = {
      provider: 'OpenAI',
      model: 'gpt-5.4',
      modelVersion: '2026-06-01',
      generatedAt: new Date('2026-07-29T11:59:00.000Z'),
    }

    await createMcpReview({
      subjectType: 'skill',
      subjectSlug: 'release-workflow',
      rating: 4,
      content: '流程清晰，但需要补充失败回滚示例。',
      aiAttribution: attribution,
    }, 'user-1')

    expect(createReviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: 'skill',
        subjectId: 'skill-1',
        aiAttribution: attribution,
      }),
      {
        actorType: 'user',
        actorKey: 'user:user-1',
        userId: 'user-1',
      },
    )
  })

  it('resolves an article column and preserves AI attribution', async () => {
    prismaMock.articleColumn.findUnique.mockResolvedValue({ id: 'column-1' })
    createArticleMock.mockResolvedValue({
      id: 'article-1',
      slug: 'agent-retrospective',
      status: ArticleStatus.draft,
    })
    const attribution = {
      provider: 'OpenAI',
      model: 'gpt-5.4',
      modelVersion: '2026-06-01',
    }

    await createMcpArticle({
      title: 'Agent 实践复盘',
      columnSlug: 'engineering',
      content: '这是一篇包含完整背景、执行步骤、结果与失败边界的实践复盘文章。',
      status: ArticleStatus.published,
      aiAttribution: attribution,
    }, 'user-1')

    expect(createArticleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'column-1',
        status: ArticleStatus.published,
        aiAttribution: attribution,
      }),
      'user-1',
    )
  })

  it('publishes only the owned article version explicitly confirmed by the author', async () => {
    approveAndPublishArticleMock.mockResolvedValue({
      id: 'article-1',
      title: 'Agent 实践复盘',
      slug: 'agent-retrospective',
      status: ArticleStatus.published,
      reviewStatus: 'approved',
      currentVersion: 2,
      approvedVersion: 2,
      reviewedAt: new Date('2026-08-30T12:00:00.000Z'),
      publishedAt: new Date('2026-08-30T12:00:00.000Z'),
    })

    const result = await confirmMcpArticlePublication({
      articleId: 'article-1',
      expectedVersion: 2,
      confirmation: 'CONFIRM_PUBLISH_CURRENT_VERSION',
    }, 'user-1')

    expect(approveAndPublishArticleMock).toHaveBeenCalledWith({
      id: 'article-1',
      expectedVersion: 2,
      reviewerUserId: 'user-1',
      authorUserId: 'user-1',
    })
    expect(recordAdminActionMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mcp.article.publish_confirmed',
      targetId: 'article-1',
    }))
    expect(result.href).toBe('/articles/agent-retrospective')
  })

  it('does not publish an article outside the authenticated owner scope', async () => {
    approveAndPublishArticleMock.mockResolvedValue(null)

    await expect(confirmMcpArticlePublication({
      articleId: 'someone-else-article',
      expectedVersion: 1,
      confirmation: 'CONFIRM_PUBLISH_CURRENT_VERSION',
    }, 'user-1')).rejects.toThrow('ERR_ARTICLE_NOT_FOUND')
    expect(recordAdminActionMock).not.toHaveBeenCalled()
  })
})
