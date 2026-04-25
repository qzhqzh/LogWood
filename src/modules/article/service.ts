import { prisma } from '@/lib/prisma'
import { ArticleStatus } from '@prisma/client'

const articleModel = (prisma as any).article

export interface ArticleListQuery {
  page?: number
  pageSize?: number
  status?: ArticleStatus
  search?: string
}

export interface CreateArticleInput {
  title: string
  columnId?: string
  excerpt?: string
  content: string
  tags?: string[]
  coverImageUrl?: string
  status?: ArticleStatus
}

export interface UpdateArticleInput {
  title?: string
  columnId?: string
  excerpt?: string
  content?: string
  tags?: string[]
  coverImageUrl?: string
  status?: ArticleStatus
}

function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  return base || `article-${Date.now()}`
}

async function ensureUniqueSlug(baseSlug: string, articleIdToIgnore?: string): Promise<string> {
  let slug = baseSlug
  let i = 1

  while (true) {
    const existing = await articleModel.findUnique({ where: { slug } })
    if (!existing || existing.id === articleIdToIgnore) return slug
    i += 1
    slug = `${baseSlug}-${i}`
  }
}

export async function listArticles(query: ArticleListQuery) {
  const {
    page = 1,
    pageSize = 12,
    status = ArticleStatus.published,
    search,
  } = query

  const where: any = { status }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { excerpt: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [articles, total] = await Promise.all([
    articleModel.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        column: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        excerpt: true,
        tags: true,
        coverImageUrl: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        viewCount: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    articleModel.count({ where }),
  ])

  return {
    articles: articles.map((article: any) => ({
      ...article,
      tags: parseTags(article.tags),
    })),
    total,
  }
}

export async function listAllArticlesForManage() {
  const articles = await articleModel.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      columnId: true,
      column: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      excerpt: true,
      tags: true,
      coverImageUrl: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
      viewCount: true,
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return articles.map((article: any) => ({
    ...article,
    tags: parseTags(article.tags),
  }))
}

export async function getArticleByIdForManage(id: string) {
  const article = await articleModel.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      columnId: true,
      column: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      excerpt: true,
      content: true,
      tags: true,
      coverImageUrl: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
      viewCount: true,
    },
  })

  if (!article) return null

  return {
    ...article,
    tags: parseTags(article.tags),
  }
}

export async function getArticleBySlug(slug: string) {
  const article = await articleModel.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: {
          comments: {
            where: { status: 'published' },
          },
        },
      },
    },
  })

  if (!article) return null

  return {
    ...article,
    tags: parseTags(article.tags || '[]'),
  }
}

export async function createArticle(input: CreateArticleInput, authorUserId?: string) {
  const baseSlug = slugify(input.title)
  const slug = await ensureUniqueSlug(baseSlug)

  return articleModel.create({
    data: {
      title: input.title,
      slug,
      columnId: input.columnId,
      excerpt: input.excerpt,
      content: input.content,
      tags: JSON.stringify(input.tags || []),
      coverImageUrl: input.coverImageUrl,
      status: input.status ?? ArticleStatus.draft,
      authorUserId,
      publishedAt: input.status === ArticleStatus.published ? new Date() : null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      createdAt: true,
    },
  })
}

export async function updateArticle(id: string, input: UpdateArticleInput) {
  const existing = await articleModel.findUnique({ where: { id } })
  if (!existing) return null

  let slug: string | undefined
  if (input.title && input.title !== existing.title) {
    slug = await ensureUniqueSlug(slugify(input.title), id)
  }

  const nextStatus = input.status ?? existing.status
  const shouldSetPublishedAt = existing.status !== ArticleStatus.published && nextStatus === ArticleStatus.published

  return articleModel.update({
    where: { id },
    data: {
      title: input.title,
      slug,
      columnId: input.columnId,
      excerpt: input.excerpt,
      content: input.content,
      tags: input.tags ? JSON.stringify(input.tags) : undefined,
      coverImageUrl: input.coverImageUrl,
      status: input.status,
      publishedAt: shouldSetPublishedAt ? new Date() : existing.publishedAt,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  })
}

export async function archiveArticle(id: string) {
  const existing = await articleModel.findUnique({ where: { id } })
  if (!existing) return null

  return articleModel.update({
    where: { id },
    data: {
      status: ArticleStatus.archived,
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  })
}

export async function deleteArticle(id: string) {
  const existing = await articleModel.findUnique({ where: { id } })
  if (!existing) return null

  return articleModel.delete({
    where: { id },
    select: {
      id: true,
    },
  })
}

export async function increaseArticleView(slug: string) {
  await articleModel.update({
    where: { slug },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  })
}
