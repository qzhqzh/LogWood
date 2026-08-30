import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillStatus } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  skill: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { createSkill, listPromptLibrary, updateSkillEffect } from './service'

describe('skill/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.skill.findUnique.mockResolvedValue(null)
    prismaMock.skill.findMany.mockResolvedValue([])
    prismaMock.skill.create.mockImplementation(async ({ data }) => ({
      id: 'skill-1',
      ...data,
      tags: data.tags,
    }))
    prismaMock.skill.update.mockImplementation(async ({ data }) => ({
      id: 'skill-1',
      slug: 'saved-prompt',
      category: 'image',
      tags: '["output:image"]',
      ...data,
    }))
  })

  it('creates a draft when status is omitted', async () => {
    await createSkill({
      title: '待审核提示词',
      category: 'workflow',
      prompt: '请先作为草稿保存，等待人工审核。',
    }, 'user-1')

    expect(prismaMock.skill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: SkillStatus.draft,
        authorUserId: 'user-1',
        tags: '["output:text"]',
      }),
    })
  })

  it('stores a managed-only output kind in the compatibility tag without changing the schema', async () => {
    const result = await createSkill({
      title: '视频交付提示词',
      category: 'workflow',
      prompt: '管理视频脚本与镜头提示词，不在第一阶段运行。',
      tags: ['客户交付'],
      outputKind: 'video',
    }, 'user-1')

    expect(prismaMock.skill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tags: '["客户交付","output:video"]',
      }),
    })
    expect(result).toMatchObject({
      tags: ['客户交付'],
      outputKind: 'video',
    })
  })

  it.each([SkillStatus.published, SkillStatus.archived])(
    'keeps an explicitly provided %s status',
    async (status) => {
      await createSkill({
        title: `显式状态 ${status}`,
        category: 'workflow',
        prompt: '该调用明确提供了状态。',
        status,
      })

      expect(prismaMock.skill.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status }),
      })
    },
  )

  it('lists only published prompts with real verification counts', async () => {
    prismaMock.skill.findMany.mockResolvedValue([
      {
        id: 'skill-1',
        title: '可验证提示词',
        slug: 'verified-prompt',
        category: 'workflow',
        summary: null,
        prompt: '执行正文',
        effectImageUrl: null,
        effectNote: null,
        sourceUrl: null,
        tags: '["验证"]',
        status: SkillStatus.published,
        _count: { evaluations: 2, reviews: 3 },
      },
    ])

    const result = await listPromptLibrary({ category: 'workflow', search: '验证', limit: 12 })

    expect(prismaMock.skill.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: SkillStatus.published,
        category: 'workflow',
        OR: expect.any(Array),
      }),
      include: {
        _count: {
          select: {
            reviews: { where: { status: 'published' } },
            evaluations: { where: { status: 'published' } },
          },
        },
      },
      take: 12,
    }))
    expect(result[0]).toMatchObject({
      tags: ['验证'],
      outputKind: 'text',
      _count: { evaluations: 2, reviews: 3 },
    })
  })

  it('does not query the database for an explicitly empty slug selection', async () => {
    await expect(listPromptLibrary({ slugs: [' ', ''] })).resolves.toEqual([])
    expect(prismaMock.skill.findMany).not.toHaveBeenCalled()
  })

  it('updates only the stored effect when a screenshot is attached in the workbench', async () => {
    prismaMock.skill.findUnique.mockResolvedValue({
      id: 'skill-1',
      slug: 'saved-prompt',
      category: 'image',
      tags: '["output:image"]',
      prompt: 'keep the published prompt unchanged',
      status: SkillStatus.published,
    })

    await updateSkillEffect({
      id: 'skill-1',
      effectImageUrl: '/uploads/skill-effects/new.png',
    })

    expect(prismaMock.skill.update).toHaveBeenCalledWith({
      where: { id: 'skill-1' },
      data: { effectImageUrl: '/uploads/skill-effects/new.png' },
    })
  })
})
