import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteEmoji } from '@/modules/emoji'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }

    const result = await deleteEmoji(params.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'ERR_EMOJI_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('DELETE /api/emojis/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
