import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { deleteEmoji } from '@/modules/emoji'
import { recordAdminAction } from '@/modules/audit'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const result = await deleteEmoji(params.id)

    await recordAdminAction({
      actorUserId: session.user.id,
      action: 'emoji.delete',
      targetType: 'emoji',
      targetId: params.id,
    })

    return NextResponse.json(result)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'ERR_EMOJI_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('DELETE /api/emojis/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
