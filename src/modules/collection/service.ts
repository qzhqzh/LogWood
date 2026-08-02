import { AppStatus, Prisma, SkillStatus } from '@prisma/client'
import type { App, Skill, Target, TargetType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { listPromotionOriginsForSubjects } from '@/modules/lifecycle'
import {
  SKILL_CATEGORIES,
  skillCategoryLabel,
  skillDetailPath,
} from '@/shared/skills/taxonomy'

export const COLLECTION_KINDS = ['all', 'ability', 'tool', 'visual'] as const

export type CollectionKind = (typeof COLLECTION_KINDS)[number]
export type CollectionItemKind = Exclude<CollectionKind, 'all'>

export interface CollectionItem {
  id: string
  kind: CollectionItemKind
  title: string
  summary: string
  href: string
  imageUrl: string | null
  tags: string[]
  typeLabel: string
  category: string
  origin: { title: string; href: string } | null
  updatedAt: Date | null
}

export interface CollectionQuery {
  kind?: CollectionKind
  search?: string
  category?: string
  page?: number
  pageSize?: number
}

export interface CollectionResult {
  items: CollectionItem[]
  counts: Record<CollectionKind, number>
  toolCategoryCounts: Record<string, number>
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type PromotionOrigins = Awaited<ReturnType<typeof listPromotionOriginsForSubjects>>

function parseStoredList(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function buildOriginMap(origins: PromotionOrigins) {
  const result = new Map<string, { title: string; href: string }>()
  for (const origin of origins) {
    const value = { title: origin.title, href: `/candidates/${origin.slug}` }
    if (origin.promotedTargetId) result.set(`tool:${origin.promotedTargetId}`, value)
    if (origin.promotedSkillId) result.set(`ability:${origin.promotedSkillId}`, value)
    if (origin.promotedAppId) result.set(`visual:${origin.promotedAppId}`, value)
  }
  return result
}

function mapCollectionRows(
  skills: Skill[],
  targets: Target[],
  apps: App[],
  origins = new Map<string, { title: string; href: string }>(),
): CollectionItem[] {
  return [
    ...skills.map((skill): CollectionItem => ({
      id: `ability:${skill.id}`,
      kind: 'ability',
      title: skill.title,
      summary: skill.summary || skill.prompt.slice(0, 180),
      href: `/skills/${skill.slug}`,
      imageUrl: skill.effectImageUrl,
      tags: parseStoredList(skill.tags),
      typeLabel: skillCategoryLabel(skill.category),
      category: skill.category,
      origin: origins.get(`ability:${skill.id}`) || null,
      updatedAt: skill.updatedAt,
    })),
    ...targets.map((target): CollectionItem => ({
      id: `tool:${target.id}`,
      kind: 'tool',
      title: target.name,
      summary: target.description || '历史收藏条目，等待补充使用场景和保留理由。',
      href: skillDetailPath(target.type, target.slug),
      imageUrl: target.previewImageUrl || target.logoUrl,
      tags: parseStoredList(target.features),
      typeLabel: skillCategoryLabel(target.type),
      category: target.type,
      origin: origins.get(`tool:${target.id}`) || null,
      updatedAt: target.updatedAt,
    })),
    ...apps.map((app): CollectionItem => ({
      id: `visual:${app.id}`,
      kind: 'visual',
      title: app.title,
      summary: app.summary || app.description,
      href: `/app/${app.slug}`,
      imageUrl: app.previewImageUrl,
      tags: parseStoredList(app.tags),
      typeLabel: '视觉收藏',
      category: 'visual',
      origin: origins.get(`visual:${app.id}`) || null,
      updatedAt: app.updatedAt,
    })),
  ]
}

function sortByRecent(items: CollectionItem[]) {
  return items.sort((a, b) => {
    const timeDiff = (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
    return timeDiff || a.title.localeCompare(b.title, 'zh-CN')
  })
}

function buildSearchWhere(search: string) {
  const contains = { contains: search, mode: 'insensitive' as const }
  const normalizedSearch = search.toLocaleLowerCase('zh-CN')
  const matchingTargetTypes = SKILL_CATEGORIES
    .filter((item) => `${item.label} ${item.shortLabel} ${item.key}`.toLocaleLowerCase('zh-CN')
      .includes(normalizedSearch))
    .map((item) => item.key)
  const matchesVisualType = '视觉收藏'.includes(normalizedSearch)

  const skill: Prisma.SkillWhereInput = {
    status: SkillStatus.published,
    ...(search ? {
      OR: [
        { title: contains },
        { summary: contains },
        { prompt: contains },
        { tags: contains },
        { category: contains },
        ...(matchingTargetTypes.length ? [{ category: { in: matchingTargetTypes } }] : []),
      ],
    } : {}),
  }
  const target: Prisma.TargetWhereInput = search ? {
    OR: [
      { name: contains },
      { description: contains },
      { developer: contains },
      { features: contains },
      ...(matchingTargetTypes.length ? [{ type: { in: matchingTargetTypes } }] : []),
    ],
  } : {}
  const app: Prisma.AppWhereInput = {
    status: AppStatus.published,
    ...(search && !matchesVisualType ? {
      OR: [
        { title: contains },
        { summary: contains },
        { description: contains },
        { tags: contains },
      ],
    } : {}),
  }
  return { skill, target, app, matchingTargetTypes, matchesVisualType }
}

async function listAllPageIds(input: {
  search: string
  matchingTargetTypes: TargetType[]
  matchesVisualType: boolean
  offset: number
  pageSize: number
}) {
  const pattern = `%${input.search}%`
  const skillTypeClause = input.matchingTargetTypes.length
    ? Prisma.sql`OR "category" IN (${Prisma.join(input.matchingTargetTypes)})`
    : Prisma.empty
  const targetTypeClause = input.matchingTargetTypes.length
    ? Prisma.sql`OR "type"::text IN (${Prisma.join(input.matchingTargetTypes)})`
    : Prisma.empty
  const searchSkills = input.search
    ? Prisma.sql`AND (
        "title" ILIKE ${pattern}
        OR COALESCE("summary", '') ILIKE ${pattern}
        OR "prompt" ILIKE ${pattern}
        OR "tags" ILIKE ${pattern}
        OR "category" ILIKE ${pattern}
        ${skillTypeClause}
      )`
    : Prisma.empty
  const searchTargets = input.search
    ? Prisma.sql`AND (
        "name" ILIKE ${pattern}
        OR COALESCE("description", '') ILIKE ${pattern}
        OR COALESCE("developer", '') ILIKE ${pattern}
        OR "features" ILIKE ${pattern}
        ${targetTypeClause}
      )`
    : Prisma.empty
  const searchApps = input.search && !input.matchesVisualType
    ? Prisma.sql`AND (
        "title" ILIKE ${pattern}
        OR "summary" ILIKE ${pattern}
        OR "description" ILIKE ${pattern}
        OR "tags" ILIKE ${pattern}
      )`
    : Prisma.empty

  return prisma.$queryRaw<Array<{ kind: CollectionItemKind; id: string }>>(Prisma.sql`
    SELECT "kind", "id"
    FROM (
      SELECT 'ability'::text AS "kind", "id", "title", "updatedAt"
      FROM "skills"
      WHERE "status"::text = 'published' ${searchSkills}
      UNION ALL
      SELECT 'tool'::text AS "kind", "id", "name" AS "title", "updatedAt"
      FROM "targets"
      WHERE TRUE ${searchTargets}
      UNION ALL
      SELECT 'visual'::text AS "kind", "id", "title", "updatedAt"
      FROM "apps"
      WHERE "status"::text = 'published' ${searchApps}
    ) AS "collection"
    ORDER BY "updatedAt" DESC, "title" ASC, "kind" ASC, "id" ASC
    OFFSET ${input.offset}
    LIMIT ${input.pageSize}
  `)
}

export async function listRecentCollection(limit = 6): Promise<CollectionItem[]> {
  const take = Math.max(1, Math.min(limit, 24))
  const [skills, targets, apps] = await Promise.all([
    prisma.skill.findMany({ where: { status: SkillStatus.published }, orderBy: { updatedAt: 'desc' }, take }),
    prisma.target.findMany({ orderBy: { updatedAt: 'desc' }, take }),
    prisma.app.findMany({ where: { status: AppStatus.published }, orderBy: { updatedAt: 'desc' }, take }),
  ])
  const origins = await listPromotionOriginsForSubjects({
    targetIds: targets.map((target) => target.id),
    skillIds: skills.map((skill) => skill.id),
    appIds: apps.map((app) => app.id),
  })
  return sortByRecent(mapCollectionRows(skills, targets, apps, buildOriginMap(origins))).slice(0, take)
}

export async function listCollection(query: CollectionQuery = {}): Promise<CollectionResult> {
  const kind = COLLECTION_KINDS.includes(query.kind || 'all') ? query.kind || 'all' : 'all'
  const search = query.search?.trim() || ''
  const category = query.category?.trim() || ''
  const requestedPage = Math.max(1, Math.floor(query.page || 1))
  const pageSize = Math.max(1, Math.min(Math.floor(query.pageSize || 24), 60))
  const where = buildSearchWhere(search)
  if (kind === 'tool' && category) where.target.type = category as TargetType

  const [abilityCount, toolCount, visualCount, toolGroups, filteredAbility, filteredTool, filteredVisual] = await Promise.all([
    prisma.skill.count({ where: { status: SkillStatus.published } }),
    prisma.target.count(),
    prisma.app.count({ where: { status: AppStatus.published } }),
    prisma.target.groupBy({ by: ['type'], _count: { _all: true } }),
    kind === 'all' || kind === 'ability' ? prisma.skill.count({ where: where.skill }) : Promise.resolve(0),
    kind === 'all' || kind === 'tool' ? prisma.target.count({ where: where.target }) : Promise.resolve(0),
    kind === 'all' || kind === 'visual' ? prisma.app.count({ where: where.app }) : Promise.resolve(0),
  ])
  const total = filteredAbility + filteredTool + filteredVisual
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  let skills: Skill[]
  let targets: Target[]
  let apps: App[]
  if (kind === 'all') {
    const pageIds = await listAllPageIds({
      search,
      matchingTargetTypes: where.matchingTargetTypes,
      matchesVisualType: where.matchesVisualType,
      offset,
      pageSize,
    })
    const skillIds = pageIds.filter((item) => item.kind === 'ability').map((item) => item.id)
    const targetIds = pageIds.filter((item) => item.kind === 'tool').map((item) => item.id)
    const appIds = pageIds.filter((item) => item.kind === 'visual').map((item) => item.id)
    const rows = await Promise.all([
      skillIds.length ? prisma.skill.findMany({ where: { id: { in: skillIds } } }) : Promise.resolve([]),
      targetIds.length ? prisma.target.findMany({ where: { id: { in: targetIds } } }) : Promise.resolve([]),
      appIds.length ? prisma.app.findMany({ where: { id: { in: appIds } } }) : Promise.resolve([]),
    ])
    skills = rows[0]
    targets = rows[1]
    apps = rows[2]
  } else {
    const rows = await Promise.all([
      kind === 'ability'
        ? prisma.skill.findMany({
          where: where.skill,
          orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
          skip: offset,
          take: pageSize,
        })
        : Promise.resolve([]),
      kind === 'tool'
        ? prisma.target.findMany({
          where: where.target,
          orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
          skip: offset,
          take: pageSize,
        })
        : Promise.resolve([]),
      kind === 'visual'
        ? prisma.app.findMany({
          where: where.app,
          orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
          skip: offset,
          take: pageSize,
        })
        : Promise.resolve([]),
    ])
    skills = rows[0]
    targets = rows[1]
    apps = rows[2]
  }
  const pagedItems = sortByRecent(mapCollectionRows(skills, targets, apps))
  const origins = await listPromotionOriginsForSubjects({
    targetIds: pagedItems.filter((item) => item.kind === 'tool').map((item) => item.id.slice('tool:'.length)),
    skillIds: pagedItems.filter((item) => item.kind === 'ability').map((item) => item.id.slice('ability:'.length)),
    appIds: pagedItems.filter((item) => item.kind === 'visual').map((item) => item.id.slice('visual:'.length)),
  })
  const originMap = buildOriginMap(origins)
  const items = pagedItems.map((item) => ({ ...item, origin: originMap.get(item.id) || null }))
  const counts: Record<CollectionKind, number> = {
    all: abilityCount + toolCount + visualCount,
    ability: abilityCount,
    tool: toolCount,
    visual: visualCount,
  }
  const toolCategoryCounts = Object.fromEntries(
    toolGroups.map((group) => [group.type, group._count._all]),
  )

  return { items, counts, toolCategoryCounts, page, pageSize, total, totalPages }
}
