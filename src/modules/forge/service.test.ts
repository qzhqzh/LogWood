import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ArticleStatus, SkillStatus, TargetType } from '@prisma/client'

vi.mock('@/modules/article', () => ({
  createArticle: vi.fn(),
}))

vi.mock('@/modules/skill', () => ({
  createSkill: vi.fn(),
}))

import { createArticle } from '@/modules/article'
import { createSkill } from '@/modules/skill'
import { createForgeDraft } from './service'

const createArticleMock = vi.mocked(createArticle)
const createSkillMock = vi.mocked(createSkill)

describe('forge/service createForgeDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects input that is too short', async () => {
    await expect(
      createForgeDraft({ kind: 'skill', prompt: '太短' }, 'u1'),
    ).rejects.toThrow('ERR_FORGE_PROMPT_TOO_SHORT')
  })

  it('writes a Skill draft to the independent Skill model', async () => {
    createSkillMock.mockResolvedValue({ id: 's1', slug: 'review-skill' } as any)

    const result = await createForgeDraft(
      {
        kind: 'skill',
        title: '代码审查 Skill',
        prompt: '检查变更范围、风险、测试和回滚策略，并输出结构化结论。',
        category: 'workflow',
        sourceUrl: 'https://example.com/source',
      },
      'u1',
    )

    expect(createSkillMock).toHaveBeenCalledWith(
      {
        title: '代码审查 Skill',
        category: 'workflow',
        summary: '检查变更范围、风险、测试和回滚策略，并输出结构化结论。',
        prompt: '检查变更范围、风险、测试和回滚策略，并输出结构化结论。',
        sourceUrl: 'https://example.com/source',
        tags: ['AI 炼成助手', '草稿'],
        status: SkillStatus.draft,
      },
      'u1',
    )
    expect(result.saved).toEqual({
      id: 's1',
      slug: 'review-skill',
      href: '/skills/manage?edit=s1',
    })
  })

  it('keeps legacy TargetType clients compatible while creating a Skill', async () => {
    createSkillMock.mockResolvedValue({ id: 's2', slug: 'legacy-client' } as any)

    await createForgeDraft(
      {
        kind: 'skill',
        title: '旧客户端草稿',
        prompt: '这是一段来自旧客户端、长度足够的提示内容。',
        type: TargetType.prompt,
      },
      'u2',
    )

    expect(createSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'workflow',
        status: SkillStatus.draft,
      }),
      'u2',
    )
  })

  it('continues to write article drafts to Article', async () => {
    createArticleMock.mockResolvedValue({ id: 'a1', slug: 'field-note' } as any)

    const result = await createForgeDraft(
      {
        kind: 'article',
        title: '实验小结',
        prompt: '记录这次实验的输入、输出、失败点和下一步验证计划。',
      },
      'u1',
    )

    expect(createArticleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '实验小结',
        status: ArticleStatus.draft,
        tags: ['AI 炼成助手', '草稿'],
      }),
      'u1',
    )
    expect(result.saved.href).toBe('/articles/manage')
  })
})
