import { prisma } from '@/lib/prisma'
import { CommentStatus } from '@prisma/client'
import { ActorContext } from '@/modules/identity'
import { checkAndConsume, checkIpSegmentLimit } from '@/modules/rate-limit'
import { assessContent } from '@/modules/like'

export interface CreateCommentInput {
  reviewId: string
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
    select: { id: true, status: true },
  })

  if (!review) {
    throw new Error('ERR_REVIEW_NOT_FOUND')
  }

  if (review.status === 'deleted') {
    throw new Error('ERR_REVIEW_NOT_FOUND')
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

  const comment = await prisma.comment.create({
    data: {
      reviewId: input.reviewId,
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
      content: comment.content,
      language: comment.language,
      status: comment.status,
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
    content: comment.content,
    language: comment.language,
    status: comment.status,
    likesCount: comment.likesCount,
    reportsCount: comment.reportsCount,
    createdAt: comment.createdAt,
    author: comment.user
      ? { type: 'user' as const, name: comment.user.name || 'User', avatarUrl: comment.user.avatarUrl }
      : { type: 'anonymous' as const, name: comment.anonymousUser?.displayName || '匿名用户' },
  }
}
