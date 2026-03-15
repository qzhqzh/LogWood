import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/modules/rate-limit', () => ({
  checkAndConsume: vi.fn().mockResolvedValue({ allowed: true }),
  checkIpSegmentLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/modules/target', () => ({
  getTargetById: vi.fn(),
}))

vi.mock('@/modules/like', () => ({
  assessContent: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getTargetById } from '@/modules/target'
import { assessContent } from '@/modules/like'
import { createReview } from './service'

const prismaMock = prisma as unknown as {
  review: { create: ReturnType<typeof vi.fn> }
}

const getTargetByIdMock = getTargetById as unknown as ReturnType<typeof vi.fn>
const assessContentMock = assessContent as unknown as ReturnType<typeof vi.fn>

describe('review/service createReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws validation error for invalid rating', async () => {
    await expect(
      createReview(
        {
          targetId: 't1',
          rating: 6,
          content: 'a'.repeat(80),
        },
        { userId: 'u1' }
      )
    ).rejects.toThrow('ERR_REVIEW_VALIDATION')
  })

  it('throws not found when target missing', async () => {
    getTargetByIdMock.mockResolvedValue(null)

    await expect(
      createReview(
        {
          targetId: 'missing',
          rating: 4,
          content: 'a'.repeat(80),
        },
        { userId: 'u1' }
      )
    ).rejects.toThrow('ERR_TARGET_NOT_FOUND')
  })

  it('creates pending review when content is flagged', async () => {
    getTargetByIdMock.mockResolvedValue({ id: 't1' })
    assessContentMock.mockReturnValue({ flagged: true, reason: 'sensitive_word' })
    prismaMock.review.create.mockResolvedValue({
      id: 'r1',
      status: ReviewStatus.pending,
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
    })

    const result = await createReview(
      {
        targetId: 't1',
        rating: 4,
        content: 'a'.repeat(80),
      },
      { anonymousUserId: 'au1' }
    )

    expect(prismaMock.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReviewStatus.pending,
          language: 'zh',
        }),
      })
    )
    expect(result.status).toBe(ReviewStatus.pending)
  })
})
