import { ArticleStatus, TargetType } from '@prisma/client'
import { createArticle } from '@/modules/article'
import { createTarget } from '@/modules/target'

export type ForgeDraftKind = 'article' | 'skill'

export interface ForgeDraftInput {
  kind: ForgeDraftKind
  prompt: string
  title?: string
  /** skill only */
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
    '<p><em>（造物台占位生成：后续可接入真实模型；当前为本地模板草稿。）</em></p>',
  ].join('\n')
  return { title, excerpt, content, description: cleaned.slice(0, 500) }
}

/**
 * Minimal forge draft writer: turns a prompt into an Article draft or Skill draft.
 * No external LLM yet — reserved hook for future model providers.
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
        tags: ['造物台', '草稿'],
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
        href: `/articles/manage`,
      },
      note: '已写入洞笔记草稿，可在笔记管理中继续编辑后发布。',
    }
  }

  const skill = await createTarget({
    name: synthesized.title.slice(0, 80),
    type: input.type || TargetType.prompt,
    description: synthesized.description,
    sourceUrl: input.sourceUrl,
    features: ['造物台'],
  })

  return {
    kind: 'skill',
    title: synthesized.title,
    content: synthesized.description,
    saved: {
      id: skill.id,
      slug: skill.slug,
      href: `/${skill.type}/${skill.slug}`,
    },
    note: '已写入 Skill 草稿条目，可在 Skill 管理中补效果图与对比分组。',
  }
}
