import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  skill: { count: vi.fn(), findMany: vi.fn() },
  target: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  app: { count: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/modules/lifecycle', () => ({ listPromotionOriginsForSubjects: vi.fn() }))

import { listPromotionOriginsForSubjects } from '@/modules/lifecycle'
import { listCollection } from './service'

const listOriginsMock = vi.mocked(listPromotionOriginsForSubjects)

function skillRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: '写作流程',
    slug: 'writing',
    category: 'writing',
    summary: null,
    prompt: '先列提纲',
    effectImageUrl: null,
    effectNote: null,
    sourceUrl: null,
    tags: '["写作"]',
    status: 'published',
    authorUserId: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
    ...overrides,
  }
}

describe('collection/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.skill.count.mockResolvedValue(0)
    prismaMock.target.count.mockResolvedValue(0)
    prismaMock.app.count.mockResolvedValue(0)
    prismaMock.skill.findMany.mockResolvedValue([])
    prismaMock.target.findMany.mockResolvedValue([])
    prismaMock.app.findMany.mockResolvedValue([])
    prismaMock.target.groupBy.mockResolvedValue([])
    prismaMock.$queryRaw.mockResolvedValue([])
    listOriginsMock.mockResolvedValue([])
  })

  it('adapts Skill, Target and App rows without changing detail URLs', async () => {
    prismaMock.skill.count.mockResolvedValue(1)
    prismaMock.target.count.mockResolvedValue(1)
    prismaMock.app.count.mockResolvedValue(1)
    prismaMock.skill.findMany.mockResolvedValue([skillRow()])
    prismaMock.target.findMany.mockResolvedValue([{
      id: 't1', name: 'Cursor', slug: 'cursor', type: 'editor', logoUrl: null,
      description: '编辑器', websiteUrl: null, developer: null, features: '["编码"]',
      previewImageUrl: null, sourceUrl: null, compareGroup: null,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-01'),
    }])
    prismaMock.app.findMany.mockResolvedValue([{
      id: 'a1', name: 'shot', slug: 'shot', appUrl: '/uploads/shot.png', title: '界面截图',
      summary: '视觉参考', description: '视觉参考', previewImageUrl: '/uploads/shot.png',
      tags: '["界面"]', status: 'published', authorUserId: null,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-15'),
    }])
    prismaMock.target.groupBy.mockResolvedValue([{ type: 'editor', _count: { _all: 1 } }])
    prismaMock.$queryRaw.mockResolvedValue([
      { kind: 'ability', id: 's1' },
      { kind: 'visual', id: 'a1' },
      { kind: 'tool', id: 't1' },
    ])
    listOriginsMock.mockResolvedValue([{
      id: 'c1', title: '截图灵感', slug: 'shot-origin',
      promotedTargetId: null, promotedSkillId: null, promotedAppId: 'a1',
    }])

    const result = await listCollection()

    expect(result.counts).toEqual({ all: 3, ability: 1, tool: 1, visual: 1 })
    expect(result.toolCategoryCounts).toEqual({ editor: 1 })
    expect(result.items.find((item) => item.id === 'visual:a1')?.origin?.href).toBe('/candidates/shot-origin')
    expect(result.items.map((item) => item.href)).toEqual([
      '/skills/writing',
      '/app/shot',
      '/editor/cursor',
    ])
  })

  it('pushes kind and text search into the database query', async () => {
    prismaMock.skill.count.mockResolvedValue(1)
    prismaMock.skill.findMany.mockResolvedValue([skillRow({
      title: '移动端截图分析',
      slug: 'mobile-shot',
      category: 'image',
      summary: '分析界面风格',
      prompt: '分析',
      tags: '["视觉"]',
    })])

    const result = await listCollection({ kind: 'ability', search: '视觉' })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].title).toBe('移动端截图分析')
    expect(prismaMock.skill.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'published',
        OR: expect.arrayContaining([{ tags: { contains: '视觉', mode: 'insensitive' } }]),
      }),
      skip: 0,
      take: 24,
    }))
    expect(prismaMock.target.findMany).not.toHaveBeenCalled()
    expect(prismaMock.app.findMany).not.toHaveBeenCalled()
  })

  it('uses a bounded window and reports pagination metadata', async () => {
    prismaMock.skill.count.mockResolvedValue(30)
    prismaMock.skill.findMany.mockResolvedValue(
      Array.from({ length: 24 }, (_, index) => skillRow({
        id: `s${index}`,
        slug: `skill-${index}`,
        title: `Skill ${index}`,
      })),
    )

    const result = await listCollection({ kind: 'ability', page: 1 })

    expect(result.total).toBe(30)
    expect(result.totalPages).toBe(2)
    expect(result.items).toHaveLength(24)
    expect(prismaMock.skill.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 24 }))
  })

  it('matches the fixed visual type label without loading unrelated kinds', async () => {
    prismaMock.app.count.mockResolvedValue(1)
    prismaMock.app.findMany.mockResolvedValue([{
      id: 'a1', name: 'shot', slug: 'shot', appUrl: '/uploads/shot.png', title: '界面截图',
      summary: '视觉参考', description: '视觉参考', previewImageUrl: '/uploads/shot.png',
      tags: '[]', status: 'published', authorUserId: null,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-15'),
    }])

    const result = await listCollection({ kind: 'visual', search: '视觉收藏' })

    expect(result.items).toHaveLength(1)
    expect(prismaMock.app.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'published' },
      skip: 0,
      take: 24,
    }))
    expect(prismaMock.skill.findMany).not.toHaveBeenCalled()
    expect(prismaMock.target.findMany).not.toHaveBeenCalled()
  })

  it('uses a constant-size UNION page for deep all-collection pages', async () => {
    prismaMock.skill.count.mockResolvedValue(80)
    prismaMock.target.count.mockResolvedValue(80)
    prismaMock.app.count.mockResolvedValue(80)
    prismaMock.$queryRaw.mockResolvedValue([])

    const result = await listCollection({ kind: 'all', page: 10 })

    expect(result.page).toBe(10)
    expect(result.pageSize).toBe(24)
    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce()
    expect(prismaMock.skill.findMany).not.toHaveBeenCalled()
    expect(prismaMock.target.findMany).not.toHaveBeenCalled()
    expect(prismaMock.app.findMany).not.toHaveBeenCalled()
  })
})
