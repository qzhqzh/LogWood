import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportStatus, ReportTargetType, CommentStatus, ArticleStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    report: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    review: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    article: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    articleComment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/modules/rate-limit', () => ({
  checkAndConsume: vi.fn().mockResolvedValue({ allowed: true }),
}))

import { prisma } from '@/lib/prisma'
import { createReport, applyAutoHideIfThresholdReached, resolveReport } from './service'

const prismaMock = prisma as unknown as {
  report: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  review: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  comment: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  article: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  articleComment: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
}

describe('moderation/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates report for article target', async () => {
    prismaMock.article.findUnique.mockResolvedValue({ id: 'a1', status: ArticleStatus.published })
    prismaMock.report.create.mockResolvedValue({ id: 'r1', status: ReportStatus.open })
    prismaMock.report.count.mockResolvedValue(1)

    const result = await createReport(
      { targetType: ReportTargetType.article, targetId: 'a1', reason: 'spam content' },
      { userId: 'u1' }
    )

    expect(result).toEqual({ id: 'r1', status: ReportStatus.open })
    expect(prismaMock.report.create).toHaveBeenCalled()
  })

  it('auto-hides article comment when threshold reached', async () => {
    prismaMock.report.count.mockResolvedValue(5)

    const hidden = await applyAutoHideIfThresholdReached(ReportTargetType.article_comment, 'ac1')

    expect(hidden).toBe(true)
    expect(prismaMock.articleComment.update).toHaveBeenCalledWith({
      where: { id: 'ac1' },
      data: { status: CommentStatus.hidden, reportsCount: 5 },
    })
  })

  it('archives article when resolving open article report', async () => {
    prismaMock.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: ReportStatus.open,
      targetType: ReportTargetType.article,
      targetId: 'a1',
    })

    await resolveReport('r1', 'resolve')

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: ArticleStatus.archived },
    })
  })
})
