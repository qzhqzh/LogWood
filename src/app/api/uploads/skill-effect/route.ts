import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { fileMatchesMime } from '@/lib/file-signature'
import { persistPublicUpload } from '@/lib/public-upload'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ERR_INVALID_FILE' }, { status: 400 })
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: '仅支持 jpg/png/webp/gif' }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!fileMatchesMime(buffer, file.type)) {
      return NextResponse.json(
        { error: '文件签名与声明的类型不一致，已拒绝' },
        { status: 400 },
      )
    }

    const ext = EXTENSION_BY_MIME[file.type] || 'bin'
    const fileName = `${Date.now()}-${randomUUID()}.${ext}`
    const url = await persistPublicUpload({
      category: 'skill-effects',
      fileName,
      buffer,
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('POST /api/uploads/skill-effect error:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
