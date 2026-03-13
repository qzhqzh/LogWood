import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteTag } from '@/modules/tag'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }

    const result = await deleteTag(params.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'ERR_TAG_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('DELETE /api/tags/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
