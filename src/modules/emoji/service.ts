import { prisma } from '@/lib/prisma'

export interface EmojiItem {
  id: string
  name: string
  symbol: string
  slug: string
  createdAt: Date
}

export interface CreateEmojiInput {
  name: string
  symbol: string
}

const emojiModel = (prisma as any).emoji

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `emoji-${Date.now()}`
}

export async function listEmojis(): Promise<EmojiItem[]> {
  const emojis = await emojiModel.findMany({
    orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      symbol: true,
      slug: true,
      createdAt: true,
    },
  })

  return emojis as EmojiItem[]
}

export async function createEmoji(input: CreateEmojiInput): Promise<EmojiItem> {
  const normalizedName = input.name.trim()
  const normalizedSymbol = input.symbol.trim()

  if (!normalizedName) {
    throw new Error('ERR_EMOJI_NAME_REQUIRED')
  }
  if (!normalizedSymbol) {
    throw new Error('ERR_EMOJI_SYMBOL_REQUIRED')
  }

  const slug = slugify(normalizedName)
  const existing = await emojiModel.findFirst({
    where: {
      OR: [{ slug }, { name: normalizedName }, { symbol: normalizedSymbol }],
    },
    select: {
      id: true,
      name: true,
      symbol: true,
      slug: true,
      createdAt: true,
    },
  })

  if (existing) {
    return existing as EmojiItem
  }

  const created = await emojiModel.create({
    data: {
      name: normalizedName,
      symbol: normalizedSymbol,
      slug,
    },
    select: {
      id: true,
      name: true,
      symbol: true,
      slug: true,
      createdAt: true,
    },
  })

  return created as EmojiItem
}

export async function deleteEmoji(id: string) {
  const existing = await emojiModel.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('ERR_EMOJI_NOT_FOUND')
  }

  return emojiModel.delete({
    where: { id },
    select: { id: true },
  })
}
