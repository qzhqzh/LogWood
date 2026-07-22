import { prisma } from '@/lib/prisma'
import { SkillStatus } from '@prisma/client'
import {
  SKILL_CATEGORY_ORDER,
  skillCategoryLabel,
} from './constants'

export {
  SKILL_CATEGORY_ORDER,
  SKILL_CATEGORY_LABELS,
  SKILL_STATUSES,
  skillCategoryLabel,
} from './constants'

export interface CreateSkillInput {
  title: string
  category: string
  summary?: string
  prompt: string
  effectImageUrl?: string
  effectNote?: string
  sourceUrl?: string
  tags?: string[]
  status?: SkillStatus
  sortOrder?: number
}

export interface UpdateSkillInput extends CreateSkillInput {
  id: string
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || `skill-${Date.now()}`
  )
}

async function ensureUniqueSlug(baseSlug: string, ignoreId?: string): Promise<string> {
  let slug = baseSlug
  let i = 1
  while (true) {
    const existing = await prisma.skill.findUnique({ where: { slug } })
    if (!existing || existing.id === ignoreId) return slug
    i += 1
    slug = `${baseSlug}-${i}`
  }
}

function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

function mapSkill<T extends { tags: string }>(skill: T): Omit<T, 'tags'> & { tags: string[] } {
  return {
    ...skill,
    tags: parseTags(skill.tags),
  }
}

export async function listPublishedSkills(category?: string) {
  const where: { status: SkillStatus; category?: string } = {
    status: SkillStatus.published,
  }
  if (category?.trim()) where.category = category.trim()

  const skills = await prisma.skill.findMany({
    where,
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
  })

  return skills.map(mapSkill)
}

export async function listSkillsGrouped(category?: string) {
  const skills = await listPublishedSkills(category)
  const groups = new Map<string, typeof skills>()

  for (const skill of skills) {
    const key = skill.category || 'other'
    const bucket = groups.get(key) || []
    bucket.push(skill)
    groups.set(key, bucket)
  }

  const known = SKILL_CATEGORY_ORDER.filter((key) => groups.has(key))
  const extras = Array.from(groups.keys()).filter(
    (key) => !(SKILL_CATEGORY_ORDER as readonly string[]).includes(key),
  ).sort()

  return [...known, ...extras].map((key) => ({
    category: key,
    label: skillCategoryLabel(key),
    skills: groups.get(key) || [],
  }))
}

export async function listAllSkillsForAdmin() {
  const skills = await prisma.skill.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
  })
  return skills.map(mapSkill)
}

export async function getSkillBySlug(slug: string, opts?: { includeDraft?: boolean }) {
  const skill = await prisma.skill.findUnique({ where: { slug } })
  if (!skill) return null
  if (!opts?.includeDraft && skill.status !== SkillStatus.published) return null
  return mapSkill(skill)
}

export async function createSkill(input: CreateSkillInput, authorUserId?: string) {
  const slug = await ensureUniqueSlug(slugify(input.title))
  const category = input.category.trim() || 'other'

  return prisma.skill.create({
    data: {
      title: input.title.trim(),
      slug,
      category,
      summary: input.summary?.trim() || null,
      prompt: input.prompt,
      effectImageUrl: input.effectImageUrl?.trim() || null,
      effectNote: input.effectNote?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      tags: JSON.stringify(input.tags || []),
      status: input.status ?? SkillStatus.published,
      sortOrder: input.sortOrder ?? 0,
      authorUserId,
    },
  }).then(mapSkill)
}

export async function updateSkill(input: UpdateSkillInput) {
  const existing = await prisma.skill.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_SKILL_NOT_FOUND')

  let slug = existing.slug
  if (input.title.trim() !== existing.title) {
    slug = await ensureUniqueSlug(slugify(input.title), existing.id)
  }

  return prisma.skill.update({
    where: { id: input.id },
    data: {
      title: input.title.trim(),
      slug,
      category: input.category.trim() || 'other',
      summary: input.summary?.trim() || null,
      prompt: input.prompt,
      effectImageUrl: input.effectImageUrl?.trim() || null,
      effectNote: input.effectNote?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      tags: JSON.stringify(input.tags || []),
      status: input.status ?? existing.status,
      sortOrder: input.sortOrder ?? existing.sortOrder,
    },
  }).then(mapSkill)
}

export async function deleteSkill(id: string) {
  const existing = await prisma.skill.findUnique({ where: { id } })
  if (!existing) throw new Error('ERR_SKILL_NOT_FOUND')
  return prisma.skill.delete({ where: { id }, select: { id: true, slug: true } })
}

export async function countPublishedSkills() {
  return prisma.skill.count({ where: { status: SkillStatus.published } })
}
