import { AppStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `app-${Date.now()}`
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let index = 1

  while (true) {
    const existing = await prisma.app.findUnique({ where: { slug } })
    if (!existing) return slug
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
    status = AppStatus.published,
  } = query

  const where = { status }
  const [apps, total] = await Promise.all([
    prisma.app.findMany({
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
    prisma.app.count({ where }),
  ])

  return {
    apps: apps.map((app) => ({
      ...app,
      tags: parseTags(app.tags),
    })),
    total,
  }
}

export async function listAllAppsForManage() {
  const apps = await prisma.app.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      appUrl: true,
      title: true,
      summary: true,
      status: true,
      updatedAt: true,
    },
  })

  return apps
}

export async function getAppBySlug(slug: string) {
  const app = await prisma.app.findUnique({
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

export async function createApp(input: CreateAppInput, authorUserId?: string) {
  const baseSlug = slugify(input.name)
  const slug = await ensureUniqueSlug(baseSlug)

  const app = await prisma.app.create({
    data: {
      name: input.name,
      slug,
      appUrl: input.appUrl,
      title: input.title,
      summary: input.summary,
      description: input.description,
      previewImageUrl: input.previewImageUrl || null,
      tags: JSON.stringify(input.tags || []),
      status: input.status || AppStatus.published,
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
