import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    articleColumn: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createArticleColumn, listArticleColumns } from './service'

const prismaMock = prisma as unknown as {
  articleColumn: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

describe('article-column/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists columns ordered by createdAt asc', async () => {
    prismaMock.articleColumn.findMany.mockResolvedValue([])

    await listArticleColumns()

    expect(prismaMock.articleColumn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }],
      })
    )
  })

  it('returns existing column by name', async () => {
    prismaMock.articleColumn.findFirst.mockResolvedValue({
      id: 'c1',
      name: 'Vision',
      slug: 'vision',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    })

    const result = await createArticleColumn({ name: 'Vision' })

    expect(prismaMock.articleColumn.create).not.toHaveBeenCalled()
    expect(result.slug).toBe('vision')
  })

  it('creates unique slug when collision exists', async () => {
    prismaMock.articleColumn.findFirst.mockResolvedValue(null)
    prismaMock.articleColumn.findUnique
      .mockResolvedValueOnce({ id: 'existing', slug: 'vision' })
      .mockResolvedValueOnce(null)

    prismaMock.articleColumn.create.mockResolvedValue({
      id: 'c2',
      name: 'Vision',
      slug: 'vision-2',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    })

    const result = await createArticleColumn({ name: 'Vision' })

    expect(result.slug).toBe('vision-2')
  })
})
