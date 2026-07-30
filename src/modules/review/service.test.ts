import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActorType, ReviewStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      create: vi.fn(),
    },
    target: {
      findUnique: vi.fn(),
    },
    skill: {
      findUnique: vi.fn(),
    },
    app: {
      findUnique: vi.fn(),
    },
    candidate: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/modules/rate-limit', () => ({
  checkAndConsume: vi.fn().mockResolvedValue({ allowed: true }),
  checkIpSegmentLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/modules/like', () => ({
  assessContent: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { assessContent } from '@/modules/like'
import { createReview } from './service'

const prismaMock = prisma as unknown as {
  review: { create: ReturnType<typeof vi.fn> }
  target: { findUnique: ReturnType<typeof vi.fn> }
}

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
        { actorType: ActorType.user, actorKey: 'user:u1', userId: 'u1' }
      )
    ).rejects.toThrow('ERR_REVIEW_VALIDATION')
  })

  it('throws not found when target missing', async () => {
    prismaMock.target.findUnique.mockResolvedValue(null)

    await expect(
      createReview(
        {
          targetId: 'missing',
          rating: 4,
          content: 'a'.repeat(80),
        },
        { actorType: ActorType.user, actorKey: 'user:u1', userId: 'u1' }
      )
    ).rejects.toThrow('ERR_TARGET_NOT_FOUND')
  })

  it('creates pending review when content is flagged', async () => {
    prismaMock.target.findUnique.mockResolvedValue({ id: 't1' })
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
      {
        actorType: ActorType.anonymous,
        actorKey: 'anonymous:au1',
        anonymousUserId: 'au1',
      }
    )

    expect(prismaMock.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReviewStatus.pending,
          language: 'zh',
          targetId: 't1',
          skillId: null,
        }),
      })
    )
    expect(result.status).toBe(ReviewStatus.pending)
  })

  it('records complete AI attribution for an AI-authored review', async () => {
    prismaMock.target.findUnique.mockResolvedValue({ id: 't1' })
    assessContentMock.mockReturnValue({ flagged: false })
    prismaMock.review.create.mockResolvedValue({
      id: 'r1',
      status: ReviewStatus.published,
      createdAt: new Date('2026-07-29T12:00:00.000Z'),
    })
    const generatedAt = new Date('2026-07-29T11:58:00.000Z')

    await createReview(
      {
        targetId: 't1',
        rating: 4,
        content: '这是一条由 Agent 提交的真实使用记录。',
        aiAttribution: {
          provider: 'OpenAI',
          model: 'gpt-5.4',
          modelVersion: '2026-06-01',
          generatedAt,
        },
      },
      { actorType: ActorType.user, actorKey: 'user:u1', userId: 'u1' },
    )

    expect(prismaMock.review.create).toHaveBeenCalledWith(
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
})
