import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateLimit: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { checkAndConsume, checkIpSegmentLimit, getRemainingQuota } from './service'

const prismaMock = prisma as unknown as {
  rateLimit: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

describe('rate-limit/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows unknown action config without persistence', async () => {
    const result = await checkAndConsume(
      'unknown_action' as any,
      { actorType: 'user', actorKey: 'user:u1', userId: 'u1' }
    )

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(Infinity)
    expect(prismaMock.rateLimit.findUnique).not.toHaveBeenCalled()
  })

  it('rejects when existing count exceeds max', async () => {
    prismaMock.rateLimit.findUnique.mockResolvedValue({ id: 'x1', count: 10 })

    const result = await checkAndConsume(
      'review_create',
      { actorType: 'user', actorKey: 'user:u1', userId: 'u1' },
      1
    )

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('updates existing counter and returns remaining quota', async () => {
    prismaMock.rateLimit.findUnique.mockResolvedValue({ id: 'x2', count: 3 })
    prismaMock.rateLimit.update.mockResolvedValue({ id: 'x2', count: 4 })

    const result = await checkAndConsume(
      'comment_create',
      { actorType: 'anonymous', actorKey: 'anonymous:a1', anonymousUserId: 'a1' },
      1
    )

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(16)
  })

  it('getRemainingQuota returns full quota when no record exists', async () => {
    prismaMock.rateLimit.findUnique.mockResolvedValue(null)

    const result = await getRemainingQuota(
      'report_create',
      { actorType: 'user', actorKey: 'user:u1', userId: 'u1' }
    )

    expect(result.remaining).toBe(20)
  })

  it('ip segment limit returns infinity when ipHash missing', async () => {
    const result = await checkIpSegmentLimit(
      'like_create',
      { actorType: 'anonymous', actorKey: 'anonymous:a1', anonymousUserId: 'a1' }
    )

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(Infinity)
  })

  it('ip segment limit blocks when count reaches max', async () => {
    prismaMock.rateLimit.findUnique.mockResolvedValue({ count: 200 })

    const result = await checkIpSegmentLimit(
      'like_create',
      { actorType: 'anonymous', actorKey: 'anonymous:a1', anonymousUserId: 'a1', ipHash: 'iphash1' }
    )

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
