import { prisma } from '@/lib/prisma'
import { CommentStatus } from '@prisma/client'
import { ActorContext } from '@/modules/identity'
import { checkAndConsume, checkIpSegmentLimit } from '@/modules/rate-limit'
import { assessContent } from '@/modules/like'

export interface ArticleCommentWithAuthor {
  id: string
  articleId: string
  content: string
  language: string
  status: CommentStatus
  likesCount: number
  reportsCount: number
  createdAt: Date
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
}

const ARTICLE_COMMENT_MIN_LENGTH = 1
const ARTICLE_COMMENT_MAX_LENGTH = 500

export async function toggleArticleLike(articleId: string, actor: ActorContext): Promise<{ liked: boolean; likesCount: number }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, status: true },
  })

  if (!article || article.status !== 'published') {
    throw new Error('ERR_ARTICLE_NOT_FOUND')
  }

  const existingLike = await prisma.articleLike.findFirst({
    where: {
      articleId,
      OR: [
        { userId: actor.userId },
        { anonymousUserId: actor.anonymousUserId },
      ],
    },
  })

  if (existingLike) {
    const likesCount = await prisma.$transaction(async (tx) => {
      await tx.articleLike.deleteMany({ where: { id: existingLike.id } })
      return tx.articleLike.count({ where: { articleId } })
    })

    return { liked: false, likesCount }
  }

  const rateLimitResult = await checkAndConsume('like_create', actor)
  if (!rateLimitResult.allowed) {
    throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  }

  const ipLimit = await checkIpSegmentLimit('like_create', actor)
  if (!ipLimit.allowed) {
    throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  }

  const likesCount = await prisma.$transaction(async (tx) => {
    await tx.articleLike.create({
      data: {
        articleId,
        userId: actor.userId,
        anonymousUserId: actor.anonymousUserId,
      },
    })

    return tx.articleLike.count({ where: { articleId } })
  })

  return { liked: true, likesCount }
}

export async function getArticleEngagement(articleId: string, actor?: ActorContext): Promise<{ likesCount: number; commentCount: number; isLikedByMe: boolean }> {
  const [likesCount, commentCount] = await Promise.all([
    prisma.articleLike.count({ where: { articleId } }),
    prisma.articleComment.count({ where: { articleId, status: CommentStatus.published } }),
  ])

  if (!actor) {
    return {
      likesCount,
      commentCount,
      isLikedByMe: false,
    }
  }

  const liked = await prisma.articleLike.findFirst({
    where: {
      articleId,
      OR: [
        { userId: actor.userId },
        { anonymousUserId: actor.anonymousUserId },
      ],
    },
    select: { id: true },
  })

  return {
    likesCount,
    commentCount,
    isLikedByMe: Boolean(liked),
  }
}

export async function createArticleComment(
  input: { articleId: string; content: string; language?: string },
  actor: ActorContext
): Promise<{ id: string; status: CommentStatus; createdAt: Date }> {
  if (input.content.length < ARTICLE_COMMENT_MIN_LENGTH || input.content.length > ARTICLE_COMMENT_MAX_LENGTH) {
    throw new Error('ERR_ARTICLE_COMMENT_VALIDATION')
  }

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { id: true, status: true },
  })

  if (!article || article.status !== 'published') {
    throw new Error('ERR_ARTICLE_NOT_FOUND')
  }

  const rateLimitResult = await checkAndConsume('comment_create', actor)
  if (!rateLimitResult.allowed) {
    throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  }

  const ipLimit = await checkIpSegmentLimit('comment_create', actor)
  if (!ipLimit.allowed) {
    throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  }

  const moderationResult = assessContent(input.content)
  const status = moderationResult.flagged ? CommentStatus.pending : CommentStatus.published

  const comment = await prisma.articleComment.create({
    data: {
      articleId: input.articleId,
      userId: actor.userId,
      anonymousUserId: actor.anonymousUserId,
      content: input.content,
      language: input.language || 'zh',
      status,
    },
  })

  return {
    id: comment.id,
    status: comment.status,
    createdAt: comment.createdAt,
  }
}

export async function getArticleComments(
  query: { articleId: string; page?: number; pageSize?: number }
): Promise<{ comments: ArticleCommentWithAuthor[]; total: number }> {
  const { articleId, page = 1, pageSize = 20 } = query

  const where = {
    articleId,
    status: CommentStatus.published,
  }

  const [comments, total] = await Promise.all([
    prisma.articleComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        anonymousUser: { select: { id: true, displayName: true } },
      },
    }),
    prisma.articleComment.count({ where }),
  ])

  return {
    comments: comments.map((comment) => ({
      id: comment.id,
      articleId: comment.articleId,
      content: comment.content,
      language: comment.language,
      status: comment.status,
      likesCount: comment.likesCount,
      reportsCount: comment.reportsCount,
      createdAt: comment.createdAt,
      author: comment.user
        ? { type: 'user' as const, name: comment.user.name || 'User', avatarUrl: comment.user.avatarUrl }
        : { type: 'anonymous' as const, name: comment.anonymousUser?.displayName || '匿名用户' },
    })),
    total,
  }
}
