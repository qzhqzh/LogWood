import type { TargetType } from '@prisma/client'

/**
 * Maps historical TargetType values into the Skill 室 narrative.
 * DB enum values stay unchanged; only presentation labels evolve.
 */
export interface SkillCategory {
  key: TargetType
  label: string
  badge: string
  shortLabel: string
  emptyText: string
  description: string
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    key: 'editor',
    label: '创作器',
    badge: 'CREATOR',
    shortLabel: '创作器',
    emptyText: '这一格还空着——放进你常用的创作器 / 编辑器 Skill',
    description: '编辑器与创作环境：把想法落成作品的入口',
  },
  {
    key: 'coding',
    label: '编码助手',
    badge: 'CODING',
    shortLabel: '编码',
    emptyText: '还没有编码助手 Skill，种下一颗会写代码的种子',
    description: '编码助手与自动化协作方式',
  },
  {
    key: 'model',
    label: '模型能力',
    badge: 'MODEL',
    shortLabel: '模型',
    emptyText: '模型区空空如也，记下你会反复调用的模型',
    description: '模型选型与能力边界的收藏',
  },
  {
    key: 'prompt',
    label: '提示与流程',
    badge: 'FLOW',
    shortLabel: '流程',
    emptyText: '提示词与工作流还没收录，把可复用的流程放进来',
    description: '提示词、工作流与可复用的生长路径',
  },
]

export const SKILL_CATEGORY_MAP = Object.fromEntries(
  SKILL_CATEGORIES.map((item) => [item.key, item]),
) as Record<TargetType, SkillCategory>

export function skillCategoryLabel(type: TargetType | string): string {
  return SKILL_CATEGORY_MAP[type as TargetType]?.label ?? type
}

export function skillCategoryBadge(type: TargetType | string): string {
  return SKILL_CATEGORY_MAP[type as TargetType]?.badge ?? String(type).toUpperCase()
}

export function skillsListPath(category?: TargetType | string): string {
  if (!category) return '/skills'
  return `/skills?category=${category}`
}

export function skillDetailPath(type: TargetType | string, slug: string): string {
  return `/${type}/${slug}`
}
