import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { recordAdminAction } from '@/modules/audit'
import { reviewArticle } from '@/modules/article'

const reviewSchema = z.object({
  action: z.enum(['request', 'approve', 'request_changes']),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }
    const { action } = reviewSchema.parse(await request.json())
    const result = await reviewArticle({
      id: params.id,
      reviewerUserId: session.user.id,
      action,
    })
    if (!result) {
      return NextResponse.json({ error: 'ERR_ARTICLE_NOT_FOUND' }, { status: 404 })
    }
    await recordAdminAction({
      actorUserId: session.user.id,
      action: `article.review.${action}`,
      targetType: 'article',
      targetId: params.id,
      metadata: {
        version: result.currentVersion,
        approvedVersion: result.approvedVersion,
      },
    })
    revalidatePath('/articles')
    revalidatePath('/articles/manage')
    revalidatePath('/')
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_ARTICLE_REVIEW_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    console.error('POST /api/articles/:id/review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
