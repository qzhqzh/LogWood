import { prisma } from '@/lib/prisma'

export const TAG_SENTIMENTS = ['good', 'bad'] as const

export type TagSentiment = (typeof TAG_SENTIMENTS)[number]

export interface TagItem {
  id: string
  name: string
  slug: string
  sentiment: TagSentiment
  createdAt: Date
}

export interface CreateTagInput {
  name: string
  sentiment: TagSentiment
}

const tagModel = (prisma as any).tag

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `tag-${Date.now()}`
}

export async function listTags(): Promise<TagItem[]> {
  const tags = await tagModel.findMany({
    orderBy: [{ sentiment: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      sentiment: true,
      createdAt: true,
    },
  })

  return tags as TagItem[]
}

export async function createTag(input: CreateTagInput): Promise<TagItem> {
  const normalizedName = input.name.trim()
  if (!normalizedName) {
    throw new Error('ERR_TAG_NAME_REQUIRED')
  }

  const slug = slugify(normalizedName)
  const existing = await tagModel.findFirst({
    where: { OR: [{ slug }, { name: normalizedName }] },
    select: {
      id: true,
      name: true,
      slug: true,
      sentiment: true,
      createdAt: true,
    },
  })

  if (existing) {
    return existing as TagItem
  }

  const created = await tagModel.create({
    data: {
      name: normalizedName,
      slug,
      sentiment: input.sentiment,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sentiment: true,
      createdAt: true,
    },
  })

  return created as TagItem
}

export async function deleteTag(id: string) {
  const existing = await tagModel.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('ERR_TAG_NOT_FOUND')
  }

  return tagModel.delete({
    where: { id },
    select: { id: true },
  })
}
