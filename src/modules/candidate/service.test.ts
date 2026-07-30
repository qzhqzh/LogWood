import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const mock = {
    candidate: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  mock.$transaction.mockImplementation((callback) => callback(mock))
  return mock
})
const createAppMock = vi.hoisted(() => vi.fn())
const createSkillMock = vi.hoisted(() => vi.fn())
const createTargetMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/modules/app', () => ({ createApp: createAppMock }))
vi.mock('@/modules/skill', () => ({ createSkill: createSkillMock }))
vi.mock('@/modules/target', () => ({ createTarget: createTargetMock }))

import { organizeCandidate, promoteCandidate, updateCandidate } from './service'

describe('candidate/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock))
  })

  it('updates the pool and searchable tags together', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        tags: '[]',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'evaluating',
        tags: '["移动端","排版"]',
      })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 })

    await expect(organizeCandidate({
      id: 'candidate-1',
      status: 'evaluating',
      tags: ['移动端', '排版'],
    })).resolves.toMatchObject({
      status: 'evaluating',
      tags: ['移动端', '排版'],
    })

    expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith({
      where: { id: 'candidate-1', status: 'watching' },
      data: {
        status: 'evaluating',
        tags: '["移动端","排版"]',
      },
    })
  })

  it('does not reorganize a converted idea', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      status: 'promoted',
      tags: '[]',
    })

    await expect(organizeCandidate({
      id: 'candidate-1',
      status: 'dropped',
    })).rejects.toThrow('ERR_CANDIDATE_ALREADY_PROMOTED')
    expect(prismaMock.candidate.update).not.toHaveBeenCalled()
  })

  it('does not allow a pool update to impersonate an atomic promotion', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      status: 'watching',
      tags: '[]',
    })

    await expect(organizeCandidate({
      id: 'candidate-1',
      status: 'promoted',
    })).rejects.toThrow('ERR_CANDIDATE_PROMOTION_REQUIRED')
    expect(prismaMock.candidate.update).not.toHaveBeenCalled()
  })

  it('allows tags to be updated after an idea is promoted', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'promoted',
        tags: '["旧标签"]',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'promoted',
        tags: '["移动端","排版"]',
      })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 })

    await expect(organizeCandidate({
      id: 'candidate-1',
      tags: ['移动端', '排版'],
    })).resolves.toMatchObject({
      status: 'promoted',
      tags: ['移动端', '排版'],
    })
  })

  it('does not downgrade a promoted idea through the admin editor', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      title: '已收入收藏室',
      slug: 'promoted-candidate',
      status: 'promoted',
      tags: '[]',
    })

    await expect(updateCandidate({
      id: 'candidate-1',
      title: '已收入收藏室',
      status: 'evaluating',
    })).rejects.toThrow('ERR_CANDIDATE_ALREADY_PROMOTED')
    expect(prismaMock.candidate.update).not.toHaveBeenCalled()
  })

  it('does not overwrite a promotion that races with a pool update', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        tags: '[]',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'promoted',
        tags: '[]',
      })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 0 })

    await expect(organizeCandidate({
      id: 'candidate-1',
      status: 'evaluating',
    })).rejects.toThrow('ERR_CANDIDATE_ALREADY_PROMOTED')
  })

  it('does not overwrite a promotion that races with an admin edit', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        title: '待整理灵感',
        slug: 'candidate-1',
        status: 'watching',
        tags: '[]',
        rawContent: null,
        sortOrder: 0,
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        title: '待整理灵感',
        slug: 'candidate-1',
        status: 'promoted',
        tags: '[]',
      })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 0 })

    await expect(updateCandidate({
      id: 'candidate-1',
      title: '修改后的标题',
      status: 'evaluating',
    })).rejects.toThrow('ERR_CANDIDATE_ALREADY_PROMOTED')
  })

  it('does not promote a text-only idea to the gallery', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      slug: 'text-only',
      status: 'watching',
      title: '纯文本灵感',
      summary: '没有图片',
      tags: '[]',
      websiteUrl: null,
      sourceUrl: null,
      logoUrl: null,
      previewImageUrl: null,
    })

    await expect(promoteCandidate({
      id: 'candidate-1',
      to: 'gallery',
    })).rejects.toThrow('ERR_CANDIDATE_IMAGE_REQUIRED')
    expect(createAppMock).not.toHaveBeenCalled()
    expect(prismaMock.candidate.update).not.toHaveBeenCalled()
  })

  it('promotes a text idea into the skill collection', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        slug: 'repository-note',
        status: 'watching',
        title: '仓库自动化流程',
        summary: '整理仓库发布流程',
        tags: '["工作流"]',
        websiteUrl: null,
        sourceUrl: 'https://github.com/example/repository',
        logoUrl: null,
        previewImageUrl: null,
        authorUserId: 'user-1',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        slug: 'repository-note',
        status: 'promoted',
        tags: '["工作流"]',
      })
    createSkillMock.mockResolvedValue({
      id: 'skill-1',
      slug: 'repository-note',
    })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 })

    await expect(promoteCandidate({
      id: 'candidate-1',
      to: 'skill',
    })).resolves.toMatchObject({
      promoted: {
        type: 'skill',
        id: 'skill-1',
        slug: 'repository-note',
      },
    })

    expect(createSkillMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'other',
      sourceUrl: 'https://github.com/example/repository',
      tags: ['工作流'],
      status: 'published',
    }), 'user-1', prismaMock)
  })

  it('rejects a competing promotion when the candidate status changed', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      slug: 'repository-note',
      status: 'watching',
      title: '仓库自动化流程',
      summary: '整理仓库发布流程',
      tags: '[]',
      websiteUrl: null,
      sourceUrl: null,
      logoUrl: null,
      previewImageUrl: null,
      authorUserId: 'user-1',
    })
    createSkillMock.mockResolvedValue({
      id: 'skill-1',
      slug: 'repository-note',
    })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 0 })

    await expect(promoteCandidate({
      id: 'candidate-1',
      to: 'skill',
    })).rejects.toThrow('ERR_CANDIDATE_ALREADY_PROMOTED')

    expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'candidate-1',
        status: 'watching',
      },
      data: {
        status: 'promoted',
        promotedTo: 'skill',
        promotedSkillId: 'skill-1',
      },
    })
  })

  it('promotes an uploaded image with an internal source URL fallback', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        slug: 'mobile-layout',
        status: 'watching',
        title: '移动端排版',
        summary: null,
        tags: '["移动端"]',
        websiteUrl: null,
        sourceUrl: null,
        logoUrl: null,
        previewImageUrl: '/uploads/candidates/example.webp',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        slug: 'mobile-layout',
        status: 'promoted',
        tags: '["移动端"]',
      })
    createAppMock.mockResolvedValue({
      id: 'app-1',
      slug: 'mobile-layout',
    })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 })

    await expect(promoteCandidate({
      id: 'candidate-1',
      to: 'gallery',
    })).resolves.toMatchObject({
      promoted: {
        type: 'gallery',
        id: 'app-1',
        slug: 'mobile-layout',
      },
    })

    expect(createAppMock).toHaveBeenCalledWith(expect.objectContaining({
      appUrl: '/candidates/mobile-layout',
      previewImageUrl: '/uploads/candidates/example.webp',
      tags: ['移动端'],
    }), undefined, prismaMock)
  })

  it('keeps the legacy tool promotion API working transactionally', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        slug: 'legacy-tool',
        status: 'watching',
        title: '旧工具入口',
        summary: '兼容旧客户端',
        tags: '["工具"]',
        websiteUrl: 'https://example.com',
        sourceUrl: null,
        logoUrl: null,
        previewImageUrl: null,
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        slug: 'legacy-tool',
        status: 'promoted',
        tags: '["工具"]',
      })
    createTargetMock.mockResolvedValue({
      id: 'target-1',
      slug: 'legacy-tool',
    })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 })

    await expect(promoteCandidate({
      id: 'candidate-1',
      to: 'tool',
    })).resolves.toMatchObject({
      promoted: { type: 'tool', id: 'target-1' },
    })
    expect(createTargetMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: '旧工具入口' }),
      prismaMock,
    )
  })
})
