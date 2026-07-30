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

export interface CreateCommentInput {
  reviewId: string
  parentId?: string
  content: string
  language?: string
}

export interface CommentQuery {
  reviewId: string
  page?: number
  pageSize?: number
}

export interface CommentWithAuthor {
  id: string
  reviewId: string
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
  isLikedByMe?: boolean
}

const CONTENT_MIN_LENGTH = 10
const CONTENT_MAX_LENGTH = 500

export async function createComment(
  input: CreateCommentInput,
  actor: ActorContext
): Promise<{ id: string; status: CommentStatus; createdAt: Date }> {
  if (input.content.length < CONTENT_MIN_LENGTH || input.content.length > CONTENT_MAX_LENGTH) {
    throw new Error('ERR_COMMENT_VALIDATION')
  }

  const review = await prisma.review.findUnique({
    where: { id: input.reviewId },
    select: {
      id: true,
      status: true,
      userId: true,
      aiModel: true,
    },
  })

  if (!review) {
    throw new Error('ERR_REVIEW_NOT_FOUND')
  }

  if (review.status === 'deleted') {
    throw new Error('ERR_REVIEW_NOT_FOUND')
  }

  const parent = input.parentId
    ? await prisma.comment.findFirst({
      where: {
        id: input.parentId,
        reviewId: input.reviewId,
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
    throw new Error('ERR_COMMENT_PARENT_NOT_FOUND')
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
    const created = await tx.comment.create({
      data: {
        reviewId: input.reviewId,
        parentId: parent?.id,
        threadRootId: parent?.threadRootId ?? parent?.id,
        userId: actor.userId,
        anonymousUserId: actor.anonymousUserId,
        content: input.content,
        language: input.language || 'zh',
        status,
      },
    })

    if (shouldQueuePublishedComment(status, Boolean(review.userId && review.aiModel))) {
      await enqueueAgentReplyTask(tx, {
        ownerUserId: review.userId!,
        commentId: created.id,
        commentUserId: actor.userId,
        content: input.content,
        threadKey: parent?.threadRootId ?? parent?.id ?? created.id,
        sourceType: AgentReplySourceType.review,
        isDirectReply: !parent,
        parentIsOwnedAiReply: Boolean(
          parent?.userId === review.userId && parent?.aiModel,
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

export async function getComments(
  query: CommentQuery,
  actor?: ActorContext
): Promise<{ comments: CommentWithAuthor[]; total: number }> {
  const { reviewId, page = 1, pageSize = 20 } = query

  const where = {
    reviewId,
    status: CommentStatus.published,
  }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        anonymousUser: {
          select: { id: true, displayName: true },
        },
      },
    }),
    prisma.comment.count({ where }),
  ])

  const commentIds = comments.map((c) => c.id)
  let likedCommentIds: string[] = []

  if (actor && commentIds.length > 0) {
    const likes = await prisma.commentLike.findMany({
      where: {
        commentId: { in: commentIds },
        OR: [
          { userId: actor.userId },
          { anonymousUserId: actor.anonymousUserId },
        ],
      },
      select: { commentId: true },
    })
    likedCommentIds = likes.map((l) => l.commentId)
  }

  return {
    comments: comments.map((comment) => ({
      id: comment.id,
      reviewId: comment.reviewId,
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
      isLikedByMe: likedCommentIds.includes(comment.id),
    })),
    total,
  }
}

export async function getCommentById(id: string): Promise<CommentWithAuthor | null> {
  const comment = await prisma.comment.findFirst({
    where: { id, status: CommentStatus.published },
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true },
      },
      anonymousUser: {
        select: { id: true, displayName: true },
      },
    },
  })

  if (!comment) return null

  return {
    id: comment.id,
    reviewId: comment.reviewId,
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
  }
}
