import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const APP_STATUSES = ['draft', 'published', 'archived'] as const

export type AppStatus = (typeof APP_STATUSES)[number]

const appModel = (prisma as any).app

export interface AppListQuery {
  page?: number
  pageSize?: number
  status?: AppStatus
}

export interface CreateAppInput {
  name: string
  appUrl: string
  title: string
  summary: string
  description: string
  previewImageUrl?: string
  tags?: string[]
  status?: AppStatus
}

export interface UpdateAppInput {
  id: string
  name: string
  appUrl: string
  title: string
  summary: string
  description: string
  previewImageUrl?: string
  tags?: string[]
  status?: AppStatus
}

export interface PublishedApp {
  id: string
  name: string
  slug: string
  appUrl: string
  title: string
  summary: string
  description: string
  previewImageUrl: string | null
  tags: string[]
  status: AppStatus
  createdAt: Date
  updatedAt: Date
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `app-${Date.now()}`
}

function safeLink(value: string): string {
  const normalized = value.trim()
  if (/^\/(?!\/)/.test(normalized)) return normalized
  try {
    const parsed = new URL(normalized)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return normalized
    }
  } catch {
    // Fall through to the stable validation error.
  }
  throw new Error('ERR_APP_URL_INVALID')
}

async function ensureUniqueSlug(
  baseSlug: string,
  appIdToIgnore?: string,
  db: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<string> {
  const model = (db as typeof prisma).app
  let slug = baseSlug
  let index = 1

  while (true) {
    const existing = await model.findUnique({ where: { slug } })
    if (!existing || existing.id === appIdToIgnore) return slug
    index += 1
    slug = `${baseSlug}-${index}`
  }
}

function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

export async function listApps(query: AppListQuery) {
  const {
    page = 1,
    pageSize = 12,
    status = 'published',
  } = query

  const where = { status }
  const [apps, total] = await Promise.all([
    appModel.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        appUrl: true,
        title: true,
        summary: true,
        description: true,
        previewImageUrl: true,
        tags: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    appModel.count({ where }),
  ])

  return {
    apps: apps.map((app: any) => ({
      ...app,
      tags: parseTags(app.tags),
    })),
    total,
  }
}

export async function listPublishedApps(): Promise<PublishedApp[]> {
  const apps = await appModel.findMany({
    where: { status: 'published' },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      appUrl: true,
      title: true,
      summary: true,
      description: true,
      previewImageUrl: true,
      tags: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return apps.map((app: any) => ({
    ...app,
    tags: parseTags(app.tags),
  })) as PublishedApp[]
}

export async function listAllAppsForManage() {
  const apps = await appModel.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      appUrl: true,
      title: true,
      summary: true,
      description: true,
      previewImageUrl: true,
      tags: true,
      status: true,
      updatedAt: true,
    },
  })

  return apps.map((app: any) => ({
    ...app,
    tags: parseTags(app.tags),
  }))
}

export async function getAppBySlug(slug: string) {
  const app = await appModel.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      appUrl: true,
      title: true,
      summary: true,
      description: true,
      previewImageUrl: true,
      tags: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!app) return null

  return {
    ...app,
    tags: parseTags(app.tags),
  }
}

export async function createApp(
  input: CreateAppInput,
  authorUserId?: string,
  db: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const model = (db as typeof prisma).app
  const baseSlug = slugify(input.name)
  const slug = await ensureUniqueSlug(baseSlug, undefined, db)

  const app = await model.create({
    data: {
      name: input.name,
      slug,
      appUrl: safeLink(input.appUrl),
      title: input.title,
      summary: input.summary,
      description: input.description,
      previewImageUrl: input.previewImageUrl ? safeLink(input.previewImageUrl) : null,
      tags: JSON.stringify(input.tags || []),
      status: input.status || 'published',
      authorUserId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      title: true,
      status: true,
    },
  })

  return app
}

export async function updateApp(input: UpdateAppInput) {
  const existing = await appModel.findUnique({
    where: { id: input.id },
    select: { id: true, name: true },
  })

  if (!existing) {
    throw new Error('ERR_APP_NOT_FOUND')
  }

  let nextSlug: string | undefined
  if (input.name !== existing.name) {
    nextSlug = await ensureUniqueSlug(slugify(input.name), input.id)
  }

  const app = await appModel.update({
    where: { id: input.id },
    data: {
      name: input.name,
      slug: nextSlug,
      appUrl: safeLink(input.appUrl),
      title: input.title,
      summary: input.summary,
      description: input.description,
      previewImageUrl: input.previewImageUrl ? safeLink(input.previewImageUrl) : null,
      tags: JSON.stringify(input.tags || []),
      status: input.status || 'published',
    },
    select: {
      id: true,
      name: true,
      slug: true,
      title: true,
      status: true,
    },
  })

  return app
}
