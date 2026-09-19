import { CandidateStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  AWESOME_SKILL_CATEGORIES,
  AWESOME_SKILL_COMPATIBILITY,
  AWESOME_SKILL_EFFORTS,
  AWESOME_SKILL_KINDS,
  AWESOME_SKILL_MATURITY,
  AWESOME_SKILL_PERMISSIONS,
  AWESOME_SKILL_SCHEMA,
  type AwesomeSkillDossier,
} from '@/content/awesome-skills'

const catalogTags = { contains: '"catalog:skill"' }
const catalogWhere = {
  AND: [{ tags: { contains: '"awesome"' } }, { tags: catalogTags }],
}

const choice = (values: readonly { id: string }[]) => z.string().refine(
  (value) => values.some((item) => item.id === value),
  { message: '请选择有效的目录选项' },
)
const httpUrl = z.string().trim().url().refine(
  (value) => /^https?:\/\//i.test(value),
  { message: '仅支持 http(s) 来源地址' },
)

export const managedSkillDossierSchema = z.object({
  schema: z.literal(AWESOME_SKILL_SCHEMA),
  upstreamName: z.string().trim().min(2).max(180),
  category: choice(AWESOME_SKILL_CATEGORIES),
  kinds: z.array(choice(AWESOME_SKILL_KINDS)).min(1),
  compatibility: z.array(choice(AWESOME_SKILL_COMPATIBILITY)).min(1),
  permissions: z.array(choice(AWESOME_SKILL_PERMISSIONS)).min(1),
  maturity: choice(AWESOME_SKILL_MATURITY),
  effort: choice(AWESOME_SKILL_EFFORTS),
  license: z.string().trim().min(2).max(180),
  licenseStatus: z.enum(['clear', 'review', 'restricted']),
  artifact: z.string().trim().min(2).max(180),
  whyItMatters: z.string().trim().min(10).max(2000),
  firstLook: z.string().trim().min(10).max(2000),
  auditNote: z.string().trim().min(10).max(3000),
  skillUrl: httpUrl,
  promptSlug: z.string().trim().max(180).optional(),
}).passthrough()

export const managedSkillInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(8).max(1000),
  websiteUrl: httpUrl,
  sourceUrl: httpUrl,
  dossier: managedSkillDossierSchema,
  status: z.enum(['watching', 'evaluating', 'dropped']),
})

export const managedSkillUpdateSchema = managedSkillInputSchema.extend({
  id: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
})

export type ManagedSkillInput = z.infer<typeof managedSkillInputSchema>

function slugify(title: string) {
  return `awesome-skill-${title.toLowerCase().trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')}`
}

function catalogTagsFor(dossier: AwesomeSkillDossier, existing: string[] = []) {
  const generated = [
    'awesome',
    'catalog:skill',
    `skill-category:${dossier.category}`,
    `maturity:${dossier.maturity}`,
    `license-status:${dossier.licenseStatus}`,
    ...dossier.kinds.map((kind) => `skill-kind:${kind}`),
    ...dossier.compatibility.map((target) => `compatibility:${target}`),
    ...dossier.permissions.map((permission) => `permission:${permission}`),
  ]
  const managedPrefixes = [
    'skill-category:', 'maturity:', 'license-status:', 'skill-kind:',
    'compatibility:', 'permission:',
  ]
  return Array.from(new Set([
    ...existing.filter((tag) => tag !== 'awesome' && tag !== 'catalog:skill'
      && !managedPrefixes.some((prefix) => tag.startsWith(prefix))),
    ...generated,
  ]))
}

function parseExistingTags(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : []
  } catch {
    return []
  }
}

function parseManagedDossier(raw: string | null) {
  try {
    return managedSkillDossierSchema.safeParse(JSON.parse(raw || 'null')).data ?? null
  } catch {
    return null
  }
}

function normalizeDossier(input: ManagedSkillInput): AwesomeSkillDossier {
  const dossier = input.dossier as AwesomeSkillDossier
  return { ...dossier, ...(dossier.promptSlug ? {} : { promptSlug: undefined }) }
}

async function assertPublishedPromptLink(dossier: AwesomeSkillDossier) {
  if (!dossier.promptSlug) return
  const prompt = await prisma.skill.findFirst({
    where: { slug: dossier.promptSlug, status: 'published' },
    select: { id: true },
  })
  if (!prompt) throw new Error('ERR_SKILL_CATALOG_PROMPT_NOT_PUBLISHED')
}

async function assertUniqueSkillSource(skillUrl: string, excludeId?: string) {
  const source = new URL(skillUrl)
  const sourceKey = `${source.origin}${source.pathname.replace(/\/+$/, '')}`
  const rows = await prisma.candidate.findMany({
    where: catalogWhere,
    select: { id: true, rawContent: true },
  })
  for (const row of rows) {
    if (row.id === excludeId) continue
    const existingUrl = parseManagedDossier(row.rawContent)?.skillUrl
    if (!existingUrl) continue
    const existingSource = new URL(existingUrl)
    if (`${existingSource.origin}${existingSource.pathname.replace(/\/+$/, '')}` === sourceKey) {
      throw new Error('ERR_SKILL_CATALOG_SOURCE_DUPLICATE')
    }
  }
}

export async function listManagedAgentSkills() {
  const rows = await prisma.candidate.findMany({
    where: catalogWhere,
    select: {
      id: true, slug: true, title: true, summary: true, websiteUrl: true,
      sourceUrl: true, rawContent: true, status: true, updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
  })

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
    dossier: parseManagedDossier(row.rawContent),
  }))
}

export async function createManagedAgentSkill(input: ManagedSkillInput, authorUserId: string) {
  const slug = slugify(input.title)
  if (slug === 'awesome-skill-') throw new Error('ERR_SKILL_CATALOG_TITLE')
  const dossier = normalizeDossier(input)
  await assertPublishedPromptLink(dossier)
  await assertUniqueSkillSource(dossier.skillUrl)
  const row = await prisma.candidate.create({
    data: {
      title: input.title,
      slug,
      summary: input.summary,
      websiteUrl: input.websiteUrl,
      sourceUrl: input.sourceUrl,
      rawContent: JSON.stringify(dossier),
      tags: JSON.stringify(catalogTagsFor(dossier)),
      status: input.status as CandidateStatus,
      authorUserId,
    },
    select: { id: true, slug: true },
  })
  return row
}

export async function updateManagedAgentSkill(input: z.infer<typeof managedSkillUpdateSchema>) {
  const existing = await prisma.candidate.findFirst({
    where: { id: input.id, ...catalogWhere },
    select: { id: true, tags: true, rawContent: true, status: true },
  })
  if (!existing) throw new Error('ERR_SKILL_CATALOG_NOT_FOUND')
  if (existing.status === CandidateStatus.promoted) throw new Error('ERR_SKILL_CATALOG_LOCKED')

  const dossier = normalizeDossier(input)
  await assertPublishedPromptLink(dossier)
  await assertUniqueSkillSource(dossier.skillUrl, input.id)
  const updated = await prisma.candidate.updateMany({
    where: {
      id: input.id,
      updatedAt: new Date(input.updatedAt),
      tags: existing.tags,
      rawContent: existing.rawContent,
      status: existing.status,
      ...catalogWhere,
    },
    data: {
      title: input.title,
      summary: input.summary,
      websiteUrl: input.websiteUrl,
      sourceUrl: input.sourceUrl,
      rawContent: JSON.stringify(dossier),
      tags: JSON.stringify(catalogTagsFor(dossier, parseExistingTags(existing.tags))),
      status: input.status as CandidateStatus,
    },
  })
  if (updated.count !== 1) throw new Error('ERR_SKILL_CATALOG_CONFLICT')
  return { id: input.id }
}

export function isSkillCatalogSlugConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
