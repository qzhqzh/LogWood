import { prisma } from '@/lib/prisma'

const columnModel = (prisma as any).articleColumn

export interface ArticleColumnItem {
  id: string
  name: string
  slug: string
  createdAt: Date
}

export interface CreateArticleColumnInput {
  name: string
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `column-${Date.now()}`
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let index = 1

  while (true) {
    const existing = await columnModel.findUnique({ where: { slug } })
    if (!existing) return slug
    index += 1
    slug = `${baseSlug}-${index}`
  }
}

export async function listArticleColumns(): Promise<ArticleColumnItem[]> {
  const columns = await columnModel.findMany({
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  })

  return columns as ArticleColumnItem[]
}

export async function createArticleColumn(input: CreateArticleColumnInput): Promise<ArticleColumnItem> {
  const normalizedName = input.name.trim()
  if (!normalizedName) {
    throw new Error('ERR_COLUMN_NAME_REQUIRED')
  }

  const existingByName = await columnModel.findFirst({
    where: { name: normalizedName },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  })

  if (existingByName) {
    return existingByName as ArticleColumnItem
  }

  const slug = await ensureUniqueSlug(slugify(normalizedName))

  const created = await columnModel.create({
    data: {
      name: normalizedName,
      slug,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  })

  return created as ArticleColumnItem
}
