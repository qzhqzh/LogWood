import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    target: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createTarget, getFeatures, getTargetBySlug, listTargets, updateTarget } from './service'

const prismaMock = prisma as unknown as {
  target: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
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

  it('creates target with unique slug suffix and prompt type', async () => {
    prismaMock.target.findUnique
      .mockResolvedValueOnce({ id: 'existing', slug: 'prompt-deck' })
      .mockResolvedValueOnce(null)
    prismaMock.target.create.mockResolvedValue({
      id: 't3',
      name: 'Prompt Deck',
      slug: 'prompt-deck-2',
      type: 'prompt' as any,
    })

    const result = await createTarget({
      name: 'Prompt Deck',
      type: 'prompt' as any,
      features: ['模板', '版本'],
    })

    expect(prismaMock.target.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'prompt-deck-2',
          type: 'prompt',
          features: '["模板","版本"]',
        }),
      })
    )
    expect(result.slug).toBe('prompt-deck-2')
  })

  it('updates existing target features', async () => {
    prismaMock.target.findUnique.mockResolvedValue({ id: 't1' })
    prismaMock.target.update.mockResolvedValue({
      id: 't1',
      name: 'Cursor Pro',
      slug: 'cursor',
      type: 'editor',
    })

    const result = await updateTarget({
      id: 't1',
      name: 'Cursor Pro',
      type: 'editor',
      websiteUrl: 'https://cursor.sh',
      features: ['高效', '稳定'],
    })

    expect(prismaMock.target.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({
          features: '["高效","稳定"]',
        }),
      })
    )
    expect(result.slug).toBe('cursor')
  })
})
