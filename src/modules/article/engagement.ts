import { prisma } from '@/lib/prisma'
import {
  AgentReplySourceType,
  CommentStatus,
} from '@prisma/client'
import { ActorContext } from '@/modules/identity'
import { checkAndConsume, checkIpSegmentLimit } from '@/modules/rate-limit'
import { assessContent } from '@/modules/like'
import {
  enqueueAgentReplyTask,
  shouldQueuePublishedComment,
} from '@/modules/agent-reply/enqueue'

export interface ArticleCommentWithAuthor {
  id: string
  articleId: string
  parentId: string | null
  threadRootId: string | null
  content: string
  language: string
  status: CommentStatus
  aiProvider: string | null
  aiModel: string | null
  aiModelVersion: string | null
  aiGeneratedAt: Date | null
  aiAgentId: string | null
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
  input: {
    articleId: string
    parentId?: string
    content: string
    language?: string
  },
  actor: ActorContext
): Promise<{ id: string; status: CommentStatus; createdAt: Date }> {
  if (input.content.length < ARTICLE_COMMENT_MIN_LENGTH || input.content.length > ARTICLE_COMMENT_MAX_LENGTH) {
    throw new Error('ERR_ARTICLE_COMMENT_VALIDATION')
  }

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: {
      id: true,
      status: true,
      authorUserId: true,
      aiModel: true,
    },
  })

  if (!article || article.status !== 'published') {
    throw new Error('ERR_ARTICLE_NOT_FOUND')
  }

  const parent = input.parentId
    ? await prisma.articleComment.findFirst({
      where: {
        id: input.parentId,
        articleId: input.articleId,
        status: CommentStatus.published,
      },
      select: {
        id: true,
        userId: true,
        aiModel: true,
        threadRootId: true,
      },
    })
    : null
  if (input.parentId && !parent) {
    throw new Error('ERR_ARTICLE_COMMENT_PARENT_NOT_FOUND')
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

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.articleComment.create({
      data: {
        articleId: input.articleId,
        parentId: parent?.id,
        threadRootId: parent?.threadRootId ?? parent?.id,
        userId: actor.userId,
        anonymousUserId: actor.anonymousUserId,
        content: input.content,
        language: input.language || 'zh',
        status,
      },
    })

    if (shouldQueuePublishedComment(
      status,
      Boolean(article.authorUserId && article.aiModel),
    )) {
      await enqueueAgentReplyTask(tx, {
        ownerUserId: article.authorUserId!,
        commentId: created.id,
        commentUserId: actor.userId,
        content: input.content,
        threadKey: parent?.threadRootId ?? parent?.id ?? created.id,
        sourceType: AgentReplySourceType.article,
        isDirectReply: !parent,
        parentIsOwnedAiReply: Boolean(
          parent?.userId === article.authorUserId && parent?.aiModel,
        ),
      })
    }
    return created
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
      parentId: comment.parentId,
      threadRootId: comment.threadRootId,
      content: comment.content,
      language: comment.language,
      status: comment.status,
      aiProvider: comment.aiProvider,
      aiModel: comment.aiModel,
      aiModelVersion: comment.aiModelVersion,
      aiGeneratedAt: comment.aiGeneratedAt,
      aiAgentId: comment.aiAgentId,
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
