import { prisma } from '@/lib/prisma'
import { ReviewStatus } from '@prisma/client'
import { ActorContext } from '@/modules/identity'
import { checkAndConsume, checkIpSegmentLimit } from '@/modules/rate-limit'
import { getTargetById } from '@/modules/target'
import { assessContent } from '@/modules/like'

export interface CreateReviewInput {
  targetId: string
  rating: number
  content: string
  language?: string
}

export interface ReviewQuery {
  sort?: 'latest' | 'hot'
  targetId?: string
  language?: string
  page?: number
  pageSize?: number
}

export interface ReviewWithAuthor {
  id: string
  targetId: string
  content: string
  rating: number
  commentCount: number
  language: string
  status: ReviewStatus
  likesCount: number
  reportsCount: number
  createdAt: Date
  updatedAt: Date
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
  target?: {
    id: string
    name: string
    slug: string
    type: string
  }
  isLikedByMe?: boolean
}

const CONTENT_MIN_LENGTH = 3
const CONTENT_MAX_LENGTH = 2000
const RATING_MIN = 1
const RATING_MAX = 5

export async function createReview(
  input: CreateReviewInput,
  actor: ActorContext
): Promise<{ id: string; status: ReviewStatus; createdAt: Date }> {
  if (input.rating < RATING_MIN || input.rating > RATING_MAX) {
    throw new Error('ERR_REVIEW_VALIDATION')
  }

  if (input.content.length < CONTENT_MIN_LENGTH || input.content.length > CONTENT_MAX_LENGTH) {
    throw new Error('ERR_REVIEW_VALIDATION')
  }

  const target = await getTargetById(input.targetId)
  if (!target) {
    throw new Error('ERR_TARGET_NOT_FOUND')
  }

  const rateLimitResult = await checkAndConsume('review_create', actor)
  if (!rateLimitResult.allowed) {
    throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  }

  const ipLimit = await checkIpSegmentLimit('review_create', actor)
  if (!ipLimit.allowed) {
    throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  }

  const moderationResult = assessContent(input.content)
  const status = moderationResult.flagged ? ReviewStatus.pending : ReviewStatus.published

  const review = await prisma.review.create({
    data: {
      userId: actor.userId,
      anonymousUserId: actor.anonymousUserId,
      targetId: input.targetId,
      content: input.content,
      rating: input.rating,
      language: input.language || 'zh',
      status,
    },
  })

  return {
    id: review.id,
    status: review.status,
    createdAt: review.createdAt,
  }
}

export async function getReviews(
  query: ReviewQuery,
  actor?: ActorContext
): Promise<{ reviews: ReviewWithAuthor[]; total: number }> {
  const {
    sort = 'latest',
    targetId,
    language,
    page = 1,
    pageSize = 20,
  } = query

  const where: any = { status: ReviewStatus.published }

  if (targetId) {
    where.targetId = targetId
  }

  if (language) {
    where.language = language
  }

  const orderBy = sort === 'hot'
    ? [{ likesCount: 'desc' as const }, { createdAt: 'desc' as const }]
    : { createdAt: 'desc' as const }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        anonymousUser: {
          select: { id: true, displayName: true },
        },
        target: {
          select: { id: true, name: true, slug: true, type: true },
        },
      },
    }),
    prisma.review.count({ where }),
  ])

  const reviewIds = reviews.map((r) => r.id)
  let likedReviewIds: string[] = []

  const publishedCommentCounts = reviewIds.length > 0
    ? await prisma.comment.groupBy({
      by: ['reviewId'],
      where: {
        reviewId: { in: reviewIds },
        status: 'published',
      },
      _count: { _all: true },
    })
    : []

  const commentCountMap = new Map(
    publishedCommentCounts.map((item) => [item.reviewId, item._count._all])
  )

  if (actor && reviewIds.length > 0) {
    const likes = await prisma.reviewLike.findMany({
      where: {
        reviewId: { in: reviewIds },
        OR: [
          { userId: actor.userId },
          { anonymousUserId: actor.anonymousUserId },
        ],
      },
      select: { reviewId: true },
    })
    likedReviewIds = likes.map((l) => l.reviewId)
  }

  return {
    reviews: reviews.map((review) => ({
      id: review.id,
      targetId: review.targetId,
      content: review.content,
      rating: review.rating,
      commentCount: commentCountMap.get(review.id) ?? 0,
      language: review.language,
      status: review.status,
      likesCount: review.likesCount,
      reportsCount: review.reportsCount,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      author: review.user
        ? { type: 'user' as const, name: review.user.name || 'User', avatarUrl: review.user.avatarUrl }
        : { type: 'anonymous' as const, name: review.anonymousUser?.displayName || '匿名用户' },
      target: review.target,
      isLikedByMe: likedReviewIds.includes(review.id),
    })),
    total,
  }
}

export async function getReviewById(
  id: string,
  actor?: ActorContext
): Promise<ReviewWithAuthor | null> {
  const review = await prisma.review.findFirst({
    where: { id, status: ReviewStatus.published },
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true },
      },
      anonymousUser: {
        select: { id: true, displayName: true },
      },
      target: {
        select: { id: true, name: true, slug: true, type: true },
      },
    },
  })

  if (!review) return null

  let isLikedByMe = false
  if (actor) {
    const like = await prisma.reviewLike.findFirst({
      where: {
        reviewId: review.id,
        OR: [
          { userId: actor.userId },
          { anonymousUserId: actor.anonymousUserId },
        ],
      },
    })
    isLikedByMe = !!like
  }

  return {
    id: review.id,
    targetId: review.targetId,
    content: review.content,
    rating: review.rating,
    commentCount: await prisma.comment.count({
      where: {
        reviewId: review.id,
        status: 'published',
      },
    }),
    language: review.language,
    status: review.status,
    likesCount: review.likesCount,
    reportsCount: review.reportsCount,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    author: review.user
      ? { type: 'user' as const, name: review.user.name || 'User', avatarUrl: review.user.avatarUrl }
      : { type: 'anonymous' as const, name: review.anonymousUser?.displayName || '匿名用户' },
    target: review.target,
    isLikedByMe,
  }
}

export async function getReviewStats(targetId: string): Promise<{
  total: number
  avgRating: number
  ratingDistribution: Record<number, number>
}> {
  const reviews = await prisma.review.findMany({
    where: { targetId, status: ReviewStatus.published },
    select: { rating: true },
  })

  const total = reviews.length
  const avgRating = total > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
    : 0

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  reviews.forEach((r) => {
    ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1
  })

  return {
    total,
    avgRating: Math.round(avgRating * 10) / 10,
    ratingDistribution,
  }
}
