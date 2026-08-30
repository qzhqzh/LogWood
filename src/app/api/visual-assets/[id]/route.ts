import { AssetRightsStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { recordAdminAction } from '@/modules/audit'
import { updateVisualAssetRights } from '@/modules/visual-asset'

const schema = z.object({
  rightsStatus: z.nativeEnum(AssetRightsStatus),
  rightsNote: z.string().trim().max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    if (!isAdminSession(session)) return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    const validated = schema.parse(await request.json())
    const asset = await updateVisualAssetRights({ id: params.id, ...validated })
    await recordAdminAction({
      actorUserId: session.user.id,
      action: 'visual_asset.rights.update',
      targetType: 'visual_asset',
      targetId: asset.id,
      metadata: { rightsStatus: asset.rightsStatus },
    })
    return NextResponse.json(asset)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_VISUAL_ASSET_VALIDATION', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ERR_VISUAL_ASSET_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message.startsWith('ERR_VISUAL_ASSET_')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('PATCH /api/visual-assets/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
