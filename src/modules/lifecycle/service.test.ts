import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    target: { findUnique: vi.fn() },
    skill: { findUnique: vi.fn() },
    app: { findUnique: vi.fn() },
    candidate: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { findPromotionOrigin, listPromotionOriginsForSubjects, resolvePromotionDestination } from './service'

describe('lifecycle/service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves a promoted Candidate to the exact historical detail URL', async () => {
    vi.mocked(prisma.target.findUnique).mockResolvedValue({
      id: 't1', name: 'Cursor', slug: 'cursor', type: 'editor',
    } as any)

    const result = await resolvePromotionDestination({
      promotedTo: 'tool',
      promotedTargetId: 't1',
      promotedSkillId: null,
      promotedAppId: null,
    } as any)

    expect(result?.href).toBe('/editor/cursor')
  })

  it('returns the origin Candidate and its public history counts', async () => {
    vi.mocked(prisma.candidate.findFirst).mockResolvedValue({
      id: 'c1', title: '原始灵感', slug: 'origin',
      _count: { reviews: 3, evaluations: 1 },
    } as any)

    const result = await findPromotionOrigin('skill', 's1')

    expect(result).toEqual({
      id: 'c1', title: '原始灵感', slug: 'origin', href: '/candidates/origin',
      reviewCount: 3, evaluationCount: 1,
    })
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'promoted', promotedSkillId: 's1' } }),
    )
  })

  it('loads promotion origins for all three collection shapes in one query', async () => {
    vi.mocked(prisma.candidate.findMany).mockResolvedValue([])

    await listPromotionOriginsForSubjects({ targetIds: ['t1'], skillIds: ['s1'], appIds: ['a1'] })

    expect(prisma.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'promoted', OR: expect.any(Array) }),
      }),
    )
  })
})
