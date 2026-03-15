import { prisma } from '@/lib/prisma'
import { ActorContext } from '@/modules/identity'
import { checkAndConsume, checkIpSegmentLimit } from '@/modules/rate-limit'

export interface LikeResult {
  liked: boolean
  likesCount: number
  isNew: boolean
}

export interface LikeStats {
  total: number
  userCount: number
  anonymousCount: number
}

const SENSITIVE_WORDS = [
  '垃圾', '傻逼', '操你', '妈的', '他妈', '草泥', '尼玛',
  'fuck', 'shit', 'damn', 'asshole',
]

export function assessContent(content: string): { flagged: boolean; reason?: string } {
  const lowerContent = content.toLowerCase()
  
  for (const word of SENSITIVE_WORDS) {
    if (lowerContent.includes(word.toLowerCase())) {
      return { flagged: true, reason: 'sensitive_word' }
    }
  }

  if (content.length > 200 && /(.)\1{10,}/.test(content)) {
    return { flagged: true, reason: 'repetitive' }
  }

  return { flagged: false }
}

export async function toggleReviewLike(
  reviewId: string,
  actor: ActorContext
): Promise<LikeResult> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, status: true, likesCount: true },
  })

  if (!review) {
    throw new Error('ERR_LIKE_TARGET_NOT_FOUND')
  }

  if (review.status === 'deleted') {
    throw new Error('ERR_LIKE_TARGET_INVALID')
  }

  const existingLike = await prisma.reviewLike.findFirst({
    where: {
      reviewId,
      OR: [
        { userId: actor.userId },
        { anonymousUserId: actor.anonymousUserId },
      ],
    },
  })

  if (existingLike) {
    const likesCount = await prisma.$transaction(async (tx) => {
      await tx.reviewLike.deleteMany({
        where: { id: existingLike.id },
      })

      const nextCount = await tx.reviewLike.count({
        where: { reviewId },
      })

      await tx.review.update({
        where: { id: reviewId },
        data: { likesCount: nextCount },
      })

      return nextCount
    })

    return {
      liked: false,
      likesCount,
      isNew: false,
    }
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
    await tx.reviewLike.create({
      data: {
        reviewId,
        userId: actor.userId,
        anonymousUserId: actor.anonymousUserId,
      },
    })

    const nextCount = await tx.reviewLike.count({
      where: { reviewId },
    })

    await tx.review.update({
      where: { id: reviewId },
      data: { likesCount: nextCount },
    })

    return nextCount
  })

  return {
    liked: true,
    likesCount,
    isNew: true,
  }
}

export async function toggleCommentLike(
  commentId: string,
  actor: ActorContext
): Promise<LikeResult> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, status: true, likesCount: true },
  })

  if (!comment) {
    throw new Error('ERR_LIKE_TARGET_NOT_FOUND')
  }

  if (comment.status === 'deleted') {
    throw new Error('ERR_LIKE_TARGET_INVALID')
  }

  const existingLike = await prisma.commentLike.findFirst({
    where: {
      commentId,
      OR: [
        { userId: actor.userId },
        { anonymousUserId: actor.anonymousUserId },
      ],
    },
  })

  if (existingLike) {
    const likesCount = await prisma.$transaction(async (tx) => {
      await tx.commentLike.deleteMany({
        where: { id: existingLike.id },
      })

      const nextCount = await tx.commentLike.count({
        where: { commentId },
      })

      await tx.comment.update({
        where: { id: commentId },
        data: { likesCount: nextCount },
      })

      return nextCount
    })

    return {
      liked: false,
      likesCount,
      isNew: false,
    }
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
    await tx.commentLike.create({
      data: {
        commentId,
        userId: actor.userId,
        anonymousUserId: actor.anonymousUserId,
      },
    })

    const nextCount = await tx.commentLike.count({
      where: { commentId },
    })

    await tx.comment.update({
      where: { id: commentId },
      data: { likesCount: nextCount },
    })

    return nextCount
  })

  return {
    liked: true,
    likesCount,
    isNew: true,
  }
}

export async function getReviewLikeStats(reviewId: string): Promise<LikeStats> {
  const [total, userCount, anonymousCount] = await Promise.all([
    prisma.reviewLike.count({ where: { reviewId } }),
    prisma.reviewLike.count({ where: { reviewId, userId: { not: null } } }),
    prisma.reviewLike.count({ where: { reviewId, anonymousUserId: { not: null } } }),
  ])

  return { total, userCount, anonymousCount }
}

export async function getReviewLikeList(
  reviewId: string,
  limit: number = 20
): Promise<Array<{ type: 'user' | 'anonymous'; name: string; avatarUrl?: string | null; createdAt: Date }>> {
  const likes = await prisma.reviewLike.findMany({
    where: { reviewId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { name: true, avatarUrl: true } },
      anonymousUser: { select: { displayName: true } },
    },
  })

  return likes.map((like) => {
    if (like.user) {
      return {
        type: 'user' as const,
        name: like.user.name || 'User',
        avatarUrl: like.user.avatarUrl,
        createdAt: like.createdAt,
      }
    }
    return {
      type: 'anonymous' as const,
      name: like.anonymousUser?.displayName || '匿名用户',
      createdAt: like.createdAt,
    }
  })
}
