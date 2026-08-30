/** Built-in shelf order; unknown categories append after these. */
export const SKILL_CATEGORY_ORDER = [
  'frontend',
  'style',
  'image',
  'workflow',
  'copy',
  'other',
] as const

export const SKILL_CATEGORY_LABELS: Record<string, string> = {
  frontend: '前端组件',
  style: '视觉风格',
  image: '图像生成',
  workflow: '工作流',
  copy: '文案提示',
  other: '其他',
}

export function skillCategoryLabel(category: string): string {
  return SKILL_CATEGORY_LABELS[category] || category
}

export const SKILL_STATUSES = ['draft', 'published', 'archived'] as const

/**
 * Phase-one output contract. Only text and image prompts have live runners;
 * every other kind remains a first-class managed record without pretending a
 * verification result exists.
 *
 * Stored as one reserved tag so the existing Skill table and historical rows
 * stay untouched. Public consumers receive the derived `outputKind` and do
 * not need to understand the storage convention.
 */
export const PROMPT_OUTPUT_KINDS = [
  'text',
  'image',
  'document',
  'video',
  'other',
] as const

export type PromptOutputKind = (typeof PROMPT_OUTPUT_KINDS)[number]

export const PROMPT_OUTPUT_KIND_LABELS: Record<PromptOutputKind, string> = {
  text: '文本输出',
  image: '图片输出',
  document: '文档输出（仅管理）',
  video: '视频输出（仅管理）',
  other: '特殊用途（仅管理）',
}

const OUTPUT_TAG_PREFIX = 'output:'

export function isPromptOutputKind(value: string): value is PromptOutputKind {
  return (PROMPT_OUTPUT_KINDS as readonly string[]).includes(value)
}

export function promptOutputKind(input: {
  category: string
  tags?: readonly string[]
}): PromptOutputKind {
  const tagged = input.tags
    ?.find((tag) => tag.startsWith(OUTPUT_TAG_PREFIX))
    ?.slice(OUTPUT_TAG_PREFIX.length)

  if (tagged && isPromptOutputKind(tagged)) return tagged
  if (input.category === 'image') return 'image'
  if (input.category === 'document') return 'document'
  if (input.category === 'video') return 'video'
  return 'text'
}

export function withoutPromptOutputTag(tags: readonly string[]): string[] {
  return tags.filter((tag) => !tag.startsWith(OUTPUT_TAG_PREFIX))
}

export function withPromptOutputKind(
  tags: readonly string[],
  outputKind: PromptOutputKind,
): string[] {
  return [...withoutPromptOutputTag(tags), `${OUTPUT_TAG_PREFIX}${outputKind}`]
}

export function isRunnablePromptOutput(
  outputKind: PromptOutputKind,
): outputKind is 'text' | 'image' {
  return outputKind === 'text' || outputKind === 'image'
}
