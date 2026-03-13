import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      findUnique: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    commentLike: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/rate-limit', () => ({
  checkAndConsume: vi.fn().mockResolvedValue({ allowed: true }),
  checkIpSegmentLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/modules/like', () => ({
  assessContent: vi.fn().mockReturnValue({ flagged: false }),
}))

import { prisma } from '@/lib/prisma'
import { checkAndConsume, checkIpSegmentLimit } from '@/modules/rate-limit'
import { assessContent } from '@/modules/like'
import { createComment, getComments } from './service'

const prismaMock = prisma as unknown as {
  review: { findUnique: ReturnType<typeof vi.fn> }
  comment: {
    create: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
  commentLike: { findMany: ReturnType<typeof vi.fn> }
}

const checkAndConsumeMock = checkAndConsume as unknown as ReturnType<typeof vi.fn>
const checkIpSegmentLimitMock = checkIpSegmentLimit as unknown as ReturnType<typeof vi.fn>
const assessContentMock = assessContent as unknown as ReturnType<typeof vi.fn>

describe('comment/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws validation error for too short content', async () => {
    await expect(
      createComment(
        { reviewId: 'r1', content: 'short' },
        { actorType: 'anonymous', actorKey: 'ip:1' }
      )
    ).rejects.toThrow('ERR_COMMENT_VALIDATION')
  })

  it('throws not found when review is missing', async () => {
    prismaMock.review.findUnique.mockResolvedValue(null)

    await expect(
      createComment(
        { reviewId: 'missing', content: 'a'.repeat(20) },
        { actorType: 'anonymous', actorKey: 'ip:1' }
      )
    ).rejects.toThrow('ERR_REVIEW_NOT_FOUND')
  })

  it('throws rate limit error when quota exceeded', async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 'r1', status: 'published' })
    checkAndConsumeMock.mockResolvedValue({ allowed: false, remaining: 0 })

    await expect(
      createComment(
        { reviewId: 'r1', content: 'a'.repeat(20) },
        { actorType: 'anonymous', actorKey: 'ip:1' }
      )
    ).rejects.toThrow('ERR_RATE_LIMIT_EXCEEDED')
  })

  it('creates pending comment when moderation flags content', async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 'r1', status: 'published' })
    checkAndConsumeMock.mockResolvedValue({ allowed: true, remaining: 19 })
    checkIpSegmentLimitMock.mockResolvedValue({ allowed: true, remaining: 199 })
    assessContentMock.mockReturnValue({ flagged: true, reason: 'sensitive_word' })
    prismaMock.comment.create.mockResolvedValue({
      id: 'c1',
      status: CommentStatus.pending,
      createdAt: new Date('2026-03-13T10:00:00.000Z'),
    })

    const result = await createComment(
      { reviewId: 'r1', content: 'a'.repeat(20) },
      { actorType: 'user', actorKey: 'user:u1', userId: 'u1' }
    )

    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CommentStatus.pending,
          language: 'zh',
        }),
      })
    )
    expect(result.status).toBe(CommentStatus.pending)
  })

  it('marks isLikedByMe correctly when querying comments', async () => {
    prismaMock.comment.findMany.mockResolvedValue([
      {
        id: 'c1',
        reviewId: 'r1',
        content: 'abc',
        language: 'zh',
        status: CommentStatus.published,
        likesCount: 2,
        reportsCount: 0,
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
        user: { id: 'u1', name: 'Tester', avatarUrl: null },
        anonymousUser: null,
      },
      {
        id: 'c2',
        reviewId: 'r1',
        content: 'def',
        language: 'zh',
        status: CommentStatus.published,
        likesCount: 1,
        reportsCount: 0,
        createdAt: new Date('2026-03-13T10:00:01.000Z'),
        user: null,
        anonymousUser: { id: 'a1', displayName: '匿名#9527' },
      },
    ])
    prismaMock.comment.count.mockResolvedValue(2)
    prismaMock.commentLike.findMany.mockResolvedValue([{ commentId: 'c2' }])

    const result = await getComments(
      { reviewId: 'r1' },
      { actorType: 'anonymous', actorKey: 'anonymous:a1', anonymousUserId: 'a1' }
    )

    expect(result.total).toBe(2)
    expect(result.comments[0].isLikedByMe).toBe(false)
    expect(result.comments[1].isLikedByMe).toBe(true)
  })
})
