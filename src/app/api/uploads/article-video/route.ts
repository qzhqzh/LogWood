import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'

const MAX_SIZE_BYTES = 30 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
  'video/mpeg',
  'video/3gpp',
])

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/x-msvideo': 'avi',
  'video/mpeg': 'mpeg',
  'video/3gpp': '3gp',
}

function extensionFromName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase().trim()
  if (!ext || ext.length > 8) return 'mp4'
  return ext
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
      return NextResponse.json({ error: `当前类型 ${file.type || 'unknown'} 不支持，仅支持 mp4/webm/ogg/mov/mkv/avi/mpeg/3gp` }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: '视频大小不能超过 30MB（超过容易超时）' }, { status: 400 })
    }

    const ext = EXTENSION_BY_MIME[file.type] || extensionFromName(file.name)
    const fileName = `${Date.now()}-${randomUUID()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'articles')
    const absolutePath = path.join(uploadDir, fileName)

    await mkdir(uploadDir, { recursive: true })
    const arrayBuffer = await file.arrayBuffer()
    await writeFile(absolutePath, Buffer.from(arrayBuffer))

    return NextResponse.json({
      url: `/uploads/articles/${fileName}`,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'aborted' || (error as NodeJS.ErrnoException).code === 'ECONNRESET')
    ) {
      return NextResponse.json({ error: '上传连接已中断，请重试（建议使用稳定网络并控制视频体积）' }, { status: 408 })
    }

    console.error('POST /api/uploads/article-video error:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
