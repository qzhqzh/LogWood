import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emoji: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createEmoji, deleteEmoji, listEmojis } from './service'

const prismaMock = prisma as unknown as {
  emoji: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

describe('emoji/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists emojis', async () => {
    prismaMock.emoji.findMany.mockResolvedValue([])
    await listEmojis()
    expect(prismaMock.emoji.findMany).toHaveBeenCalled()
  })

  it('returns existing emoji when duplicate', async () => {
    prismaMock.emoji.findFirst.mockResolvedValue({
      id: 'e1',
      name: '开心',
      symbol: '😀',
      slug: '开心',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    })

    const result = await createEmoji({ name: '开心', symbol: '😀' })

    expect(prismaMock.emoji.create).not.toHaveBeenCalled()
    expect(result.id).toBe('e1')
  })

  it('creates emoji when not exists', async () => {
    prismaMock.emoji.findFirst.mockResolvedValue(null)
    prismaMock.emoji.create.mockResolvedValue({
      id: 'e2',
      name: '火箭',
      symbol: '🚀',
      slug: '火箭',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    })

    const result = await createEmoji({ name: '火箭', symbol: '🚀' })

    expect(prismaMock.emoji.create).toHaveBeenCalled()
    expect(result.id).toBe('e2')
  })

  it('deletes emoji by id', async () => {
    prismaMock.emoji.findUnique.mockResolvedValue({ id: 'e1' })
    prismaMock.emoji.delete.mockResolvedValue({ id: 'e1' })

    const result = await deleteEmoji('e1')

    expect(prismaMock.emoji.delete).toHaveBeenCalledWith({
      where: { id: 'e1' },
      select: { id: true },
    })
    expect(result.id).toBe('e1')
  })
})
