import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    target: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { getFeatures, getTargetBySlug, listTargets } from './service'

const prismaMock = prisma as unknown as {
  target: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
  }
}

describe('target/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listTargets parses features and rounds avg rating', async () => {
    prismaMock.target.findMany.mockResolvedValue([
      {
        id: 't1',
        name: 'ToolA',
        slug: 'toola',
        type: 'editor',
        logoUrl: null,
        description: 'desc',
        websiteUrl: null,
        developer: null,
        features: '["completion","chat"]',
        _count: { reviews: 3 },
        reviews: [{ rating: 4 }, { rating: 5 }, { rating: 4 }],
      },
      {
        id: 't2',
        name: 'ToolB',
        slug: 'toolb',
        type: 'coding',
        logoUrl: null,
        description: null,
        websiteUrl: null,
        developer: null,
        features: 'invalid-json',
        _count: { reviews: 0 },
        reviews: [],
      },
    ])

    const result = await listTargets()

    expect(result[0].avgRating).toBe(4.3)
    expect(result[0].features).toEqual(['completion', 'chat'])
    expect(result[1].features).toEqual([])
    expect(result[1].avgRating).toBeUndefined()
  })

  it('getTargetBySlug returns null when not found', async () => {
    prismaMock.target.findFirst.mockResolvedValue(null)

    const result = await getTargetBySlug('editor', 'missing')

    expect(result).toBeNull()
  })

  it('getFeatures deduplicates and sorts values', async () => {
    prismaMock.target.findMany.mockResolvedValue([
      { features: '["chat","completion"]' },
      { features: '["completion","agent"]' },
      { features: 'invalid-json' },
    ])

    const result = await getFeatures()

    expect(result).toEqual(['agent', 'chat', 'completion'])
  })
})
