import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

const updateCommentSchema = z.object({
  action: z.enum(['hide', 'publish']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action } = updateCommentSchema.parse(body)

    const existing = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing || existing.status === 'deleted') {
      return NextResponse.json({ error: 'ERR_COMMENT_NOT_FOUND' }, { status: 404 })
    }

    const nextStatus = action === 'hide' ? 'hidden' : 'published'
    const updated = await prisma.comment.update({
      where: { id },
      data: { status: nextStatus },
      select: { id: true, status: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_COMMENT_VALIDATION', details: error.errors }, { status: 400 })
    }

    console.error('PATCH /api/comments/manage/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'ERR_COMMENT_NOT_FOUND' }, { status: 404 })
    }

    await prisma.comment.delete({ where: { id } })

    return NextResponse.json({ id })
  } catch (error) {
    console.error('DELETE /api/comments/manage/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
