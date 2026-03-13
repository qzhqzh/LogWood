import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    app: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createApp, getAppBySlug, listApps } from './service'

const prismaMock = prisma as unknown as {
  app: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}

describe('app/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates app with unique slug suffix when collision exists', async () => {
    prismaMock.app.findUnique
      .mockResolvedValueOnce({ id: 'existing', slug: 'dev-toolbox' })
      .mockResolvedValueOnce(null)
    prismaMock.app.create.mockResolvedValue({
      id: 'app1',
      name: 'Dev Toolbox',
      slug: 'dev-toolbox-2',
      title: 'Dev Toolbox',
      status: AppStatus.published,
    })

    const result = await createApp({
      name: 'Dev Toolbox',
      appUrl: 'https://example.com',
      title: 'Dev Toolbox',
      summary: 'summary',
      description: 'description',
    }, 'u1')

    expect(prismaMock.app.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'dev-toolbox-2',
          authorUserId: 'u1',
        }),
      })
    )
    expect(result.slug).toBe('dev-toolbox-2')
  })

  it('lists published apps by default', async () => {
    prismaMock.app.findMany.mockResolvedValue([])
    prismaMock.app.count.mockResolvedValue(0)

    const result = await listApps({})

    expect(prismaMock.app.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: AppStatus.published },
      })
    )
    expect(result.total).toBe(0)
  })

  it('parses app tags from storage', async () => {
    prismaMock.app.findUnique.mockResolvedValue({
      id: 'app1',
      name: 'Dev Toolbox',
      slug: 'dev-toolbox',
      appUrl: 'https://example.com',
      title: 'Dev Toolbox',
      summary: 'summary',
      description: 'description',
      previewImageUrl: null,
      tags: '["workflow","tooling"]',
      status: AppStatus.published,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    })

    const result = await getAppBySlug('dev-toolbox')

    expect(result?.tags).toEqual(['workflow', 'tooling'])
  })
})
