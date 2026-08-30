import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const mock = {
    candidate: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
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

import {
  createCandidate,
  deleteCandidate,
  getCandidateBySlug,
  listCandidates,
  organizeCandidate,
  promoteCandidate,
  updateCandidate,
  updateCandidateDraftContent,
  updateCandidatePreview,
} from './service'

describe('candidate/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock))
    prismaMock.candidate.findMany.mockResolvedValue([])
  })

  it('keeps private workbench drafts out of public candidate queries', async () => {
    await expect(listCandidates()).resolves.toEqual([])

    expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        NOT: { tags: { contains: '"visibility:private"' } },
      }),
    }))
  })

  it('stores private visibility as a reserved tag without exposing it as a user tag', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue(null)
    prismaMock.candidate.create.mockImplementation(async ({ data }) => ({
      id: 'candidate-private-1',
      ...data,
    }))

    const result = await createCandidate({
      title: 'Untitled Capture',
      rawContent: '',
      tags: ['output:image'],
      visibility: 'private',
    }, 'user-1')

    expect(prismaMock.candidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rawContent: null,
        tags: '["output:image","visibility:private"]',
        authorUserId: 'user-1',
      }),
    })
    expect(result).toMatchObject({
      tags: ['output:image'],
      visibility: 'private',
    })
  })

  it('rejects a private Candidate that points at a publicly served preview', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue(null)

    await expect(createCandidate({
      title: 'Leaky Capture',
      previewImageUrl: '/uploads/candidates/leaky.webp',
      visibility: 'private',
    }, 'user-1')).rejects.toThrow('ERR_CANDIDATE_PRIVATE_PREVIEW_REQUIRED')

    expect(prismaMock.candidate.create).not.toHaveBeenCalled()
  })

  it('does not reveal a private draft through its public slug', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-private-1',
      slug: 'untitled-capture',
      authorUserId: 'user-1',
      tags: '["output:image","visibility:private"]',
      reviews: [],
      _count: { reviews: 0 },
    })

    await expect(getCandidateBySlug('untitled-capture')).resolves.toBeNull()
    await expect(getCandidateBySlug('untitled-capture', {
      viewerUserId: 'user-1',
    })).resolves.toMatchObject({
      visibility: 'private',
      tags: ['output:image'],
    })
  })

  it('blocks promotion until a private capture has passed an explicit human gate', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-private-1',
      slug: 'untitled-capture',
      status: 'watching',
      tags: '["output:image","visibility:private"]',
    })

    await expect(promoteCandidate({
      id: 'candidate-private-1',
      to: 'skill',
    })).rejects.toThrow('ERR_CANDIDATE_PRIVATE_DRAFT')
    expect(createSkillMock).not.toHaveBeenCalled()
  })

  it('updates only the private draft body and allows an explicit empty value', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        rawContent: 'old prompt',
        tags: '["visibility:private"]',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        rawContent: null,
        tags: '["visibility:private"]',
      })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 })

    await expect(updateCandidateDraftContent({
      id: 'candidate-1',
      rawContent: '   ',
    })).resolves.toMatchObject({ rawContent: null, visibility: 'private' })

    expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'candidate-1',
        status: 'watching',
        tags: '["visibility:private"]',
      },
      data: { rawContent: null },
    })
  })

  it('updates a candidate preview without overwriting its prompt or metadata', async () => {
    const privatePreview = '/private-uploads/candidates/1724670000000-12345678-1234-1234-1234-123456789abc.png'
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        rawContent: 'keep this prompt',
        tags: '["visibility:private"]',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        rawContent: 'keep this prompt',
        previewImageUrl: privatePreview,
        tags: '["visibility:private"]',
      })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 })

    await updateCandidatePreview({
      id: 'candidate-1',
      previewImageUrl: privatePreview,
    })

    expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'candidate-1',
        status: 'watching',
        tags: '["visibility:private"]',
      },
      data: { previewImageUrl: privatePreview },
    })
  })

  it('rejects public preview URLs when a generic update makes a Candidate private', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      title: 'Capture',
      slug: 'capture',
      status: 'watching',
      tags: '[]',
      rawContent: null,
      websiteUrl: null,
      sourceUrl: null,
      logoUrl: null,
      previewImageUrl: '/uploads/candidates/old.webp',
      sortOrder: 0,
    })

    await expect(updateCandidate({
      id: 'candidate-1',
      title: 'Capture',
      visibility: 'private',
      previewImageUrl: '/uploads/candidates/old.webp',
    })).rejects.toThrow('ERR_CANDIDATE_PRIVATE_PREVIEW_REQUIRED')

    expect(prismaMock.candidate.updateMany).not.toHaveBeenCalled()
  })

  it('aborts a public preview update if visibility changes concurrently', async () => {
    prismaMock.candidate.findUnique
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        tags: '[]',
      })
      .mockResolvedValueOnce({
        id: 'candidate-1',
        status: 'watching',
        tags: '["visibility:private"]',
      })
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 0 })

    await expect(updateCandidatePreview({
      id: 'candidate-1',
      previewImageUrl: '/uploads/skill-effects/public.png',
    })).rejects.toThrow('ERR_CANDIDATE_STATE_CONFLICT')

    expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith({
      where: { id: 'candidate-1', status: 'watching', tags: '[]' },
      data: { previewImageUrl: '/uploads/skill-effects/public.png' },
    })
  })

  it('keeps dropped history instead of physically deleting it', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      slug: 'discarded-idea',
      status: 'dropped',
      promotedTo: null,
      promotedTargetId: null,
      promotedSkillId: null,
      promotedAppId: null,
    })

    await expect(deleteCandidate('candidate-1')).rejects.toThrow('ERR_CANDIDATE_HISTORY_PROTECTED')
    expect(prismaMock.candidate.delete).not.toHaveBeenCalled()
  })

  it('allows an unprocessed candidate without history metadata to be deleted', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      id: 'candidate-1',
      slug: 'duplicate-inbox-item',
      status: 'watching',
      promotedTo: null,
      promotedTargetId: null,
      promotedSkillId: null,
      promotedAppId: null,
    })
    prismaMock.candidate.delete.mockResolvedValue({ id: 'candidate-1', slug: 'duplicate-inbox-item' })

    await expect(deleteCandidate('candidate-1')).resolves.toEqual({
      id: 'candidate-1',
      slug: 'duplicate-inbox-item',
    })
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
      where: { id: 'candidate-1', status: 'watching', tags: '[]' },
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
      status: 'draft',
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
