import { ArticleStatus, SkillStatus, TargetType } from '@prisma/client'
import { createArticle } from '@/modules/article'
import { createSkill } from '@/modules/skill'

export type ForgeDraftKind = 'article' | 'skill'

export interface ForgeDraftInput {
  kind: ForgeDraftKind
  prompt: string
  title?: string
  /** Preferred Skill category. */
  category?: string
  /** @deprecated Legacy Forge clients sent a TargetType. */
  type?: TargetType
  sourceUrl?: string
}

export interface ForgeDraftResult {
  kind: ForgeDraftKind
  title: string
  content: string
  excerpt?: string
  saved: {
    id: string
    slug: string
    href: string
  }
  note: string
}

function synthesizeFromPrompt(prompt: string, titleHint?: string) {
  const cleaned = prompt.trim().replace(/\s+/g, ' ')
  const title = (titleHint?.trim() || cleaned.slice(0, 40) || '未命名草稿').trim()
  const excerpt = cleaned.slice(0, 120)
  const content = [
    `<p>${cleaned}</p>`,
    '<p><em>（AI 炼成助手 Beta：当前只做本地模板整理，尚未调用真实模型。）</em></p>',
  ].join('\n')
  return { title, excerpt, content, description: cleaned.slice(0, 500) }
}

function categoryFromLegacyType(type?: TargetType): string {
  if (type === TargetType.editor || type === TargetType.coding) return 'workflow'
  if (type === TargetType.model) return 'other'
  return 'workflow'
}

/**
 * Minimal draft writer used before a real model provider is connected.
 *
 * It performs deterministic local formatting only. Article drafts are written
 * to Article; Skill drafts must be written to the independent Skill model so
 * the resulting content follows the current product domain and management UI.
 */
export async function createForgeDraft(
  input: ForgeDraftInput,
  authorUserId: string,
): Promise<ForgeDraftResult> {
  const prompt = input.prompt.trim()
  if (prompt.length < 8) {
    throw new Error('ERR_FORGE_PROMPT_TOO_SHORT')
  }

  const synthesized = synthesizeFromPrompt(prompt, input.title)

  if (input.kind === 'article') {
    const article = await createArticle(
      {
        title: synthesized.title,
        excerpt: synthesized.excerpt,
        content: synthesized.content,
        tags: ['AI 炼成助手', '草稿'],
        status: ArticleStatus.draft,
      },
      authorUserId,
    )

    return {
      kind: 'article',
      title: synthesized.title,
      content: synthesized.content,
      excerpt: synthesized.excerpt,
      saved: {
        id: article.id,
        slug: article.slug,
        href: '/articles/manage',
      },
      note: '已写入洞笔记草稿，可在笔记管理中继续补充证据、引用和结论。',
    }
  }

  const skill = await createSkill(
    {
      title: synthesized.title.slice(0, 120),
      category: input.category?.trim() || categoryFromLegacyType(input.type),
      summary: synthesized.description,
      prompt,
      sourceUrl: input.sourceUrl,
      tags: ['AI 炼成助手', '草稿'],
      status: SkillStatus.draft,
    },
    authorUserId,
  )

  return {
    kind: 'skill',
    title: synthesized.title,
    content: prompt,
    saved: {
      id: skill.id,
      slug: skill.slug,
      href: `/skills/manage?edit=${skill.id}`,
    },
    note: '已写入独立 Skill 草稿，可在 Skill 管理中补充效果、来源、适用边界和验证记录。',
  }
}
