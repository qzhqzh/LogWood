import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { CommentStatus, Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { parsePage, parsePageSize, parseSearchKeyword } from '@/lib/safe-parse'
import { getReviewSubjectPresentation } from '@/shared/reviews/subject'

type ManageStatusFilter = 'all' | 'active' | 'hidden'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parsePage(searchParams.get('page'))
    const pageSize = parsePageSize(searchParams.get('pageSize'), { default: 20, max: 50 })
    const status = (searchParams.get('status') || 'active') as ManageStatusFilter
    const keyword = parseSearchKeyword(searchParams.get('q'))

    const where: Prisma.CommentWhereInput = {
      status:
        status === 'all'
          ? { in: [CommentStatus.published, CommentStatus.hidden] }
          : status === 'hidden'
            ? CommentStatus.hidden
            : CommentStatus.published,
    }

    if (keyword) {
      where.OR = [
        { content: { contains: keyword, mode: 'insensitive' } },
        { user: { name: { contains: keyword, mode: 'insensitive' } } },
        { anonymousUser: { displayName: { contains: keyword, mode: 'insensitive' } } },
        {
          review: {
            OR: [
              { content: { contains: keyword, mode: 'insensitive' } },
              { target: { name: { contains: keyword, mode: 'insensitive' } } },
              { skill: { title: { contains: keyword, mode: 'insensitive' } } },
              { app: { title: { contains: keyword, mode: 'insensitive' } } },
              { candidate: { title: { contains: keyword, mode: 'insensitive' } } },
            ],
          },
        },
      ]
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { name: true } },
          anonymousUser: { select: { displayName: true } },
          review: {
            select: {
              id: true,
              content: true,
              target: { select: { id: true, name: true, slug: true, type: true } },
              skill: { select: { id: true, title: true, slug: true } },
              app: { select: { id: true, title: true, slug: true } },
              candidate: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      }),
      prisma.comment.count({ where }),
    ])

    return NextResponse.json({
      comments: comments.map((comment) => {
        const subject = getReviewSubjectPresentation(comment.review)
        return {
          id: comment.id,
          content: comment.content,
          status: comment.status,
          createdAt: comment.createdAt,
          likesCount: comment.likesCount,
          authorName: comment.user?.name || comment.anonymousUser?.displayName || '匿名用户',
          review: {
            id: comment.review.id,
            content: comment.review.content,
            target: comment.review.target,
            subject,
          },
        }
      }),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('GET /api/comments/manage error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
