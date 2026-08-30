import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgeRequestStatus, SkillStatus, TargetType } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  forgeDraftRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/modules/article', () => ({ createArticle: vi.fn() }))
vi.mock('@/modules/skill', () => ({ createSkill: vi.fn() }))
vi.mock('./provider', () => ({
  ForgeProviderError: class ForgeProviderError extends Error {},
  generateForgeDraft: vi.fn(),
}))

import { createArticle } from '@/modules/article'
import { createSkill } from '@/modules/skill'
import {
  createForgeDraft,
  createIdempotentForgeDraft,
} from './service'

const createArticleMock = vi.mocked(createArticle)
const createSkillMock = vi.mocked(createSkill)

describe('forge/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects input that is too short', async () => {
    await expect(createForgeDraft({ kind: 'skill', prompt: '太短' }, 'u1'))
      .rejects.toThrow('ERR_FORGE_PROMPT_TOO_SHORT')
  })

  it('writes a local Skill draft without pretending it was AI generated', async () => {
    createSkillMock.mockResolvedValue({ id: 's1', slug: 'review-skill' } as never)

    const result = await createForgeDraft({
      kind: 'skill',
      mode: 'local',
      title: '代码审查 Skill',
      prompt: '检查变更范围、风险、测试和回滚策略，并输出结构化结论。',
      category: 'workflow',
      sourceUrl: 'https://example.com/source',
    }, 'u1')

    expect(createSkillMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '代码审查 Skill',
      category: 'workflow',
      sourceUrl: 'https://example.com/source',
      tags: ['本地模板', '协作草稿'],
      status: SkillStatus.draft,
      aiAttribution: undefined,
    }), 'u1')
    expect(result.mode).toBe('local')
    expect(result.attribution).toBeUndefined()
  })

  it('keeps legacy TargetType clients compatible while creating a Skill', async () => {
    createSkillMock.mockResolvedValue({ id: 's2', slug: 'legacy-client' } as never)

    await createForgeDraft({
      kind: 'skill',
      mode: 'local',
      title: '旧客户端草稿',
      prompt: '这是一段来自旧客户端、长度足够的提示内容。',
      type: TargetType.prompt,
    }, 'u2')

    expect(createSkillMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'workflow',
      status: SkillStatus.draft,
    }), 'u2')
  })

  it('replays a completed idempotent request without creating duplicate content', async () => {
    const cached = {
      kind: 'article',
      mode: 'local',
      title: '缓存草稿',
      content: '<p>缓存内容</p>',
      saved: { id: 'a1', slug: 'cached', href: '/articles/manage' },
      note: 'cached',
    }
    prismaMock.forgeDraftRequest.findUnique.mockResolvedValue({
      inputHash: expect.anything(),
      status: ForgeRequestStatus.completed,
      resultPayload: cached,
    })

    const input = {
      kind: 'article' as const,
      mode: 'local' as const,
      prompt: '记录一段足够长、可以安全重放的协作草稿内容。',
    }
    const firstLookup = prismaMock.forgeDraftRequest.findUnique
    firstLookup.mockImplementationOnce(async () => {
      const call = firstLookup.mock.calls[0]
      const key = call[0].where.ownerUserId_idempotencyKey.idempotencyKey as string
      const { createHash } = await import('node:crypto')
      const inputHash = createHash('sha256').update(JSON.stringify({
        authorUserId: 'u1', kind: 'article', prompt: input.prompt,
        title: null, category: null, type: null, sourceUrl: null,
        sourceCandidateId: null, mode: 'local',
      })).digest('hex')
      expect(key).toBe('request-123')
      return { inputHash, status: ForgeRequestStatus.completed, resultPayload: cached }
    })

    await expect(createIdempotentForgeDraft(input, 'u1', 'request-123')).resolves.toEqual(cached)
    expect(createArticleMock).not.toHaveBeenCalled()
    expect(prismaMock.forgeDraftRequest.create).not.toHaveBeenCalled()
  })

  it('rejects reuse of an idempotency key with different input', async () => {
    prismaMock.forgeDraftRequest.findUnique.mockResolvedValue({
      inputHash: 'different-hash',
      status: ForgeRequestStatus.failed,
      attempts: 1,
    })

    await expect(createIdempotentForgeDraft({
      kind: 'article',
      mode: 'local',
      prompt: '这是一段长度足够、但和原请求不同的草稿内容。',
    }, 'u1', 'request-123')).rejects.toThrow('ERR_FORGE_IDEMPOTENCY_CONFLICT')
  })
})
