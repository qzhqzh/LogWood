import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
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

    const ext = file.type.split('/')[1] || 'bin'
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
    console.error('POST /api/uploads/article-image error:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
