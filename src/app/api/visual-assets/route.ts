import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { listVisualAssetsForManage } from '@/modules/visual-asset'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  if (!isAdminSession(session)) return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
  return NextResponse.json({ assets: await listVisualAssetsForManage() })
}
