import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createTag, deleteTag, listTags } from './service'

const prismaMock = prisma as unknown as {
  tag: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

describe('tag/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists global tags', async () => {
    prismaMock.tag.findMany.mockResolvedValue([])

    await listTags()

    expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sentiment: 'asc' }, { name: 'asc' }],
      })
    )
  })

  it('returns existing tag when same name already exists', async () => {
    prismaMock.tag.findFirst.mockResolvedValue({
      id: 't1',
      name: '高效',
      slug: 'efficient',
      sentiment: 'good',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    })

    const result = await createTag({ name: '高效', sentiment: 'good' })

    expect(prismaMock.tag.create).not.toHaveBeenCalled()
    expect(result.id).toBe('t1')
  })

  it('creates tag when not exists', async () => {
    prismaMock.tag.findFirst.mockResolvedValue(null)
    prismaMock.tag.create.mockResolvedValue({
      id: 't2',
      name: '不稳定',
      slug: 'unstable',
      sentiment: 'bad',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    })

    const result = await createTag({ name: '不稳定', sentiment: 'bad' })

    expect(prismaMock.tag.create).toHaveBeenCalled()
    expect(result.slug).toBe('unstable')
  })

  it('deletes existing tag by id', async () => {
    prismaMock.tag.findUnique.mockResolvedValue({ id: 't1' })
    prismaMock.tag.delete.mockResolvedValue({ id: 't1' })

    const result = await deleteTag('t1')

    expect(prismaMock.tag.delete).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: { id: true },
    })
    expect(result.id).toBe('t1')
  })
})
