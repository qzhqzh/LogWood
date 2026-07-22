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
