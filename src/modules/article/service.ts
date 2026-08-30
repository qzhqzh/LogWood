import {
  ArticleContributionKind,
  ArticleReviewStatus,
  ArticleSourceKind,
  ArticleStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  AiAttributionInput,
  normalizeAiAttribution,
} from '@/modules/ai-attribution'
import { assessContent } from '@/modules/like'

export interface ArticleListQuery {
  page?: number
  pageSize?: number
  status?: ArticleStatus
  search?: string
}

export interface ArticleSourceInput {
  kind: ArticleSourceKind
  label: string
  candidateId?: string
  skillId?: string
  targetId?: string
  appId?: string
  evaluationId?: string
  reviewId?: string
  sourceUrl?: string
  sourceSnapshot?: Prisma.InputJsonValue
}

export interface CreateArticleInput {
  title: string
  columnId?: string
  excerpt?: string
  content: string
  tags?: string[]
  coverImageUrl?: string
  status?: ArticleStatus
  sources?: ArticleSourceInput[]
  aiAttribution?: AiAttributionInput
  contributionRole?: string
  changeSummary?: string
}

export interface UpdateArticleInput {
  title?: string
  columnId?: string
  excerpt?: string
  content?: string
  tags?: string[]
  coverImageUrl?: string
  status?: ArticleStatus
  aiAttribution?: AiAttributionInput
  contributionRole?: string
  changeSummary?: string
}

export type ArticleReviewAction = 'request' | 'approve' | 'request_changes'

function parseTags(tags: string): string[] {
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
  } catch {
    return []
  }
}

function normalizedTags(tags?: string[]): string[] {
  return Array.from(new Set((tags || []).map((tag) => tag.trim()).filter(Boolean)))
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
  let index = 1

  while (true) {
    const existing = await prisma.article.findUnique({ where: { slug } })
    if (!existing || existing.id === articleIdToIgnore) return slug
    index += 1
    slug = `${baseSlug}-${index}`
  }
}

function safeHttpUrl(value: string): string {
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
  } catch {
    // Fall through to the stable validation error.
  }
  throw new Error('ERR_ARTICLE_SOURCE_INVALID')
}

function normalizeSources(sources: ArticleSourceInput[] = []) {
  return sources.map((source) => {
    const label = source.label.trim()
    const references = [
      source.candidateId,
      source.skillId,
      source.targetId,
      source.appId,
      source.evaluationId,
      source.reviewId,
      source.sourceUrl,
    ].filter(Boolean)
    if (!label || label.length > 160 || references.length !== 1) {
      throw new Error('ERR_ARTICLE_SOURCE_INVALID')
    }
    return {
      kind: source.kind,
      label,
      candidateId: source.candidateId,
      skillId: source.skillId,
      targetId: source.targetId,
      appId: source.appId,
      evaluationId: source.evaluationId,
      reviewId: source.reviewId,
      sourceUrl: source.sourceUrl ? safeHttpUrl(source.sourceUrl) : undefined,
      sourceSnapshot: source.sourceSnapshot,
    }
  })
}

function contributionData(input: {
  articleId: string
  articleVersionId: string
  actorUserId?: string
  aiAttribution?: AiAttributionInput
  role?: string
  summary?: string
}) {
  const attribution = normalizeAiAttribution(input.aiAttribution)
  return {
    articleId: input.articleId,
    articleVersionId: input.articleVersionId,
    actorUserId: input.actorUserId,
    kind: input.aiAttribution ? ArticleContributionKind.ai : ArticleContributionKind.human,
    role: input.role?.trim() || (input.aiAttribution ? 'AI draft' : 'Author'),
    summary: input.summary?.trim() || undefined,
    ...attribution,
  }
}

export async function listArticles(query: ArticleListQuery) {
  const {
    page = 1,
    pageSize = 12,
    status = ArticleStatus.published,
    search,
  } = query

  const where: Prisma.ArticleWhereInput = { status }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { excerpt: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        column: { select: { id: true, name: true, slug: true } },
        excerpt: true,
        tags: true,
        coverImageUrl: true,
        status: true,
        reviewStatus: true,
        currentVersion: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        viewCount: true,
        aiProvider: true,
        aiModel: true,
        aiModelVersion: true,
        aiGeneratedAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.article.count({ where }),
  ])

  return {
    articles: articles.map((article) => ({ ...article, tags: parseTags(article.tags) })),
    total,
  }
}

const manageArticleSelect = {
  id: true,
  title: true,
  slug: true,
  columnId: true,
  column: { select: { id: true, name: true, slug: true } },
  excerpt: true,
  tags: true,
  coverImageUrl: true,
  status: true,
  reviewStatus: true,
  currentVersion: true,
  approvedVersion: true,
  reviewer: { select: { id: true, name: true, email: true } },
  reviewRequestedAt: true,
  reviewedAt: true,
  updatedAt: true,
  publishedAt: true,
  viewCount: true,
  aiProvider: true,
  aiModel: true,
  aiModelVersion: true,
  aiGeneratedAt: true,
  author: { select: { id: true, name: true, email: true } },
  _count: { select: { sources: true, versions: true, contributions: true } },
} satisfies Prisma.ArticleSelect

export async function listAllArticlesForManage() {
  const articles = await prisma.article.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: manageArticleSelect,
  })
  return articles.map((article) => ({ ...article, tags: parseTags(article.tags) }))
}

export async function getArticleByIdForManage(id: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      column: { select: { id: true, name: true, slug: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      sources: { orderBy: { createdAt: 'asc' } },
      versions: { orderBy: { version: 'desc' } },
      contributions: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!article) return null
  return { ...article, tags: parseTags(article.tags) }
}

export async function getArticleBySlug(slug: string) {
  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true } },
      column: { select: { id: true, name: true, slug: true } },
      sources: {
        orderBy: { createdAt: 'asc' },
        include: {
          candidate: { select: { title: true, slug: true } },
          skill: { select: { title: true, slug: true } },
          target: { select: { name: true, slug: true, type: true } },
          app: { select: { title: true, slug: true } },
          evaluation: { select: { id: true, title: true } },
          review: { select: { id: true } },
        },
      },
      versions: {
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          changeSummary: true,
          aiProvider: true,
          aiModel: true,
          aiModelVersion: true,
          aiGeneratedAt: true,
          createdAt: true,
        },
      },
      contributions: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true } } },
      },
      _count: { select: { comments: { where: { status: 'published' } } } },
    },
  })
  if (!article) return null
  return { ...article, tags: parseTags(article.tags || '[]') }
}

export async function createArticle(input: CreateArticleInput, authorUserId?: string) {
  const slug = await ensureUniqueSlug(slugify(input.title))
  const aiAttribution = normalizeAiAttribution(input.aiAttribution)
  const aiContentFlagged = Boolean(
    input.aiAttribution
    && assessContent([input.title, input.excerpt, input.content].filter(Boolean).join('\n')).flagged,
  )
  if (input.status === ArticleStatus.published && !input.aiAttribution) {
    throw new Error('ERR_ARTICLE_REVIEW_REQUIRED')
  }
  const sources = normalizeSources(input.sources)
  const tags = normalizedTags(input.tags)

  return prisma.$transaction(async (tx) => {
    const article = await tx.article.create({
      data: {
        title: input.title,
        slug,
        columnId: input.columnId,
        excerpt: input.excerpt,
        content: input.content,
        tags: JSON.stringify(tags),
        coverImageUrl: input.coverImageUrl,
        status: ArticleStatus.draft,
        reviewStatus: aiContentFlagged
          ? ArticleReviewStatus.changes_requested
          : ArticleReviewStatus.pending,
        currentVersion: 1,
        approvedVersion: null,
        authorUserId,
        ...aiAttribution,
        publishedAt: null,
      },
    })
    const version = await tx.articleVersion.create({
      data: {
        articleId: article.id,
        version: 1,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        tags: article.tags,
        coverImageUrl: article.coverImageUrl,
        editorUserId: authorUserId,
        ...aiAttribution,
        changeSummary: input.changeSummary?.trim() || 'Initial draft',
      },
    })
    await tx.articleContribution.create({
      data: contributionData({
        articleId: article.id,
        articleVersionId: version.id,
        actorUserId: authorUserId,
        aiAttribution: input.aiAttribution,
        role: input.contributionRole,
        summary: input.changeSummary,
      }),
    })
    if (sources.length > 0) {
      await tx.articleSource.createMany({
        data: sources.map((source) => ({ articleId: article.id, ...source })),
      })
    }
    return tx.article.findUniqueOrThrow({
      where: { id: article.id },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        reviewStatus: true,
        currentVersion: true,
        publishedAt: true,
        createdAt: true,
        aiProvider: true,
        aiModel: true,
        aiModelVersion: true,
        aiGeneratedAt: true,
      },
    })
  })
}

function hasContentChanges(existing: {
  title: string
  excerpt: string | null
  content: string
  tags: string
  coverImageUrl: string | null
}, input: UpdateArticleInput) {
  return (
    (input.title !== undefined && input.title !== existing.title)
    || (input.excerpt !== undefined && input.excerpt !== existing.excerpt)
    || (input.content !== undefined && input.content !== existing.content)
    || (input.coverImageUrl !== undefined && input.coverImageUrl !== existing.coverImageUrl)
    || (input.tags !== undefined && JSON.stringify(normalizedTags(input.tags)) !== existing.tags)
  )
}

export async function updateArticle(
  id: string,
  input: UpdateArticleInput,
  editorUserId?: string,
) {
  const existing = await prisma.article.findUnique({ where: { id } })
  if (!existing) return null

  const contentChanged = hasContentChanges(existing, input)
  if (
    input.status === ArticleStatus.published
    && (
      contentChanged
      || existing.reviewStatus !== ArticleReviewStatus.approved
      || existing.approvedVersion !== existing.currentVersion
    )
  ) {
    throw new Error('ERR_ARTICLE_REVIEW_REQUIRED')
  }

  const slug = input.title && input.title !== existing.title
    ? await ensureUniqueSlug(slugify(input.title), id)
    : undefined
  const nextVersion = existing.currentVersion + (contentChanged ? 1 : 0)
  const nextTags = input.tags ? normalizedTags(input.tags) : parseTags(existing.tags)
  const aiAttribution = input.aiAttribution
    ? normalizeAiAttribution(input.aiAttribution)
    : undefined

  return prisma.$transaction(async (tx) => {
    const updated = await tx.article.update({
      where: { id },
      data: {
        title: input.title,
        slug,
        columnId: input.columnId,
        excerpt: input.excerpt,
        content: input.content,
        tags: input.tags ? JSON.stringify(nextTags) : undefined,
        coverImageUrl: input.coverImageUrl,
        status: contentChanged ? ArticleStatus.draft : input.status,
        reviewStatus: contentChanged ? ArticleReviewStatus.pending : undefined,
        currentVersion: contentChanged ? nextVersion : undefined,
        approvedVersion: contentChanged ? null : undefined,
        reviewerUserId: contentChanged ? null : undefined,
        reviewedAt: contentChanged ? null : undefined,
        reviewRequestedAt: contentChanged ? null : undefined,
        ...(aiAttribution || {}),
        publishedAt: input.status === ArticleStatus.published && !contentChanged
          ? existing.publishedAt || new Date()
          : existing.publishedAt,
      },
    })

    if (contentChanged) {
      const version = await tx.articleVersion.create({
        data: {
          articleId: updated.id,
          version: nextVersion,
          title: updated.title,
          excerpt: updated.excerpt,
          content: updated.content,
          tags: updated.tags,
          coverImageUrl: updated.coverImageUrl,
          editorUserId,
          ...(aiAttribution || {
            aiProvider: null,
            aiModel: null,
            aiModelVersion: null,
            aiGeneratedAt: null,
          }),
          changeSummary: input.changeSummary?.trim() || 'Content updated',
        },
      })
      await tx.articleContribution.create({
        data: contributionData({
          articleId: updated.id,
          articleVersionId: version.id,
          actorUserId: editorUserId,
          aiAttribution: input.aiAttribution,
          role: input.contributionRole,
          summary: input.changeSummary,
        }),
      })
    }

    return tx.article.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        reviewStatus: true,
        currentVersion: true,
        approvedVersion: true,
        publishedAt: true,
        updatedAt: true,
      },
    })
  })
}

export async function reviewArticle(input: {
  id: string
  reviewerUserId: string
  action: ArticleReviewAction
}) {
  const existing = await prisma.article.findUnique({ where: { id: input.id } })
  if (!existing) return null
  const now = new Date()
  if (input.action === 'request') {
    return prisma.article.update({
      where: { id: input.id },
      data: {
        status: ArticleStatus.draft,
        reviewStatus: ArticleReviewStatus.pending,
        reviewRequestedAt: now,
        reviewedAt: null,
        reviewerUserId: null,
        approvedVersion: null,
      },
      select: {
        id: true,
        status: true,
        reviewStatus: true,
        currentVersion: true,
        approvedVersion: true,
      },
    })
  }

  const approved = input.action === 'approve'
  return prisma.article.update({
    where: { id: input.id },
    data: {
      status: ArticleStatus.draft,
      reviewStatus: approved
        ? ArticleReviewStatus.approved
        : ArticleReviewStatus.changes_requested,
      reviewerUserId: input.reviewerUserId,
      reviewRequestedAt: existing.reviewRequestedAt || now,
      reviewedAt: now,
      approvedVersion: approved ? existing.currentVersion : null,
    },
    select: {
      id: true,
      status: true,
      reviewStatus: true,
      currentVersion: true,
      approvedVersion: true,
      reviewedAt: true,
    },
  })
}

export async function addArticleSource(articleId: string, input: ArticleSourceInput) {
  const [source] = normalizeSources([input])
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } })
  if (!article) throw new Error('ERR_ARTICLE_NOT_FOUND')
  const existing = await prisma.articleSource.findFirst({
    where: {
      articleId,
      kind: source.kind,
      label: source.label,
      sourceUrl: source.sourceUrl,
      candidateId: source.candidateId,
      skillId: source.skillId,
      targetId: source.targetId,
      appId: source.appId,
      evaluationId: source.evaluationId,
      reviewId: source.reviewId,
    },
  })
  if (existing) return { source: existing, created: false }
  return {
    source: await prisma.articleSource.create({ data: { articleId, ...source } }),
    created: true,
  }
}

export async function archiveArticle(id: string) {
  const existing = await prisma.article.findUnique({ where: { id } })
  if (!existing) return null
  return prisma.article.update({
    where: { id },
    data: { status: ArticleStatus.archived },
    select: { id: true, status: true, updatedAt: true },
  })
}

export async function deleteArticle(id: string) {
  const existing = await prisma.article.findUnique({ where: { id } })
  if (!existing) return null
  return prisma.article.delete({ where: { id }, select: { id: true } })
}

export async function increaseArticleView(slug: string) {
  await prisma.article.update({ where: { slug }, data: { viewCount: { increment: 1 } } })
}
