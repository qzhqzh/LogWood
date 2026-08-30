import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { fileMatchesMime } from '@/lib/file-signature'
import {
  candidatePreviewClientUrl,
  persistPrivateCandidatePreview,
} from '@/lib/private-candidate-preview'
import { getPublicUploadLocation, persistPublicUpload } from '@/lib/public-upload'
import { getCandidateById, updateCandidatePreview } from '@/modules/candidate'
import { updateSkillEffect } from '@/modules/skill'

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

const recordBindingSchema = z.discriminatedUnion('recordType', [
  z.object({
    recordType: z.literal('skill'),
    recordId: z.string().min(1).max(191),
    effectNote: z.string().max(500).optional(),
  }),
  z.object({
    recordType: z.literal('candidate'),
    recordId: z.string().min(1).max(191),
    effectNote: z.string().max(500).optional(),
  }),
  z.object({
    recordType: z.literal('none'),
    recordId: z.undefined(),
    effectNote: z.string().max(500).optional(),
  }),
])

export async function POST(request: Request) {
  let rollbackPath: string | undefined
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
    const recordType = form.get('recordType')
    const binding = recordBindingSchema.parse({
      recordType: typeof recordType === 'string' ? recordType : 'none',
      recordId: form.get('recordId') || undefined,
      effectNote: form.get('effectNote') || undefined,
    })

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
    const boundCandidate = binding.recordType === 'candidate'
      ? await getCandidateById(binding.recordId)
      : null
    if (binding.recordType === 'candidate' && !boundCandidate) {
      throw new Error('ERR_CANDIDATE_NOT_FOUND')
    }

    let storedUrl: string
    let responseUrl: string
    if (boundCandidate?.visibility === 'private') {
      const location = await persistPrivateCandidatePreview({ fileName, buffer })
      storedUrl = location.reference
      responseUrl = candidatePreviewClientUrl(boundCandidate.id, location.reference)!
      rollbackPath = location.absolutePath
    } else {
      const location = getPublicUploadLocation('skill-effects', fileName)
      storedUrl = await persistPublicUpload({
        category: 'skill-effects',
        fileName,
        buffer,
      })
      responseUrl = storedUrl
      rollbackPath = binding.recordType === 'none' ? undefined : location.absolutePath
    }

    let record
    if (binding.recordType === 'skill') {
      record = await updateSkillEffect({
        id: binding.recordId,
        effectImageUrl: storedUrl,
        effectNote: binding.effectNote,
      })
      rollbackPath = undefined
      revalidatePath('/skills')
      revalidatePath(`/skills/${record.slug}`)
    } else if (binding.recordType === 'candidate') {
      record = await updateCandidatePreview({
        id: binding.recordId,
        previewImageUrl: storedUrl,
      })
      rollbackPath = undefined
      revalidatePath('/candidates')
      revalidatePath(`/candidates/${record.slug}`)
    }

    revalidatePath('/workbench')

    return NextResponse.json({ url: responseUrl, record })
  } catch (error) {
    if (rollbackPath) {
      await unlink(rollbackPath).catch(() => undefined)
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_EFFECT_BINDING' }, { status: 400 })
    }
    if (error instanceof Error && [
      'ERR_SKILL_NOT_FOUND',
      'ERR_CANDIDATE_NOT_FOUND',
    ].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (
      error instanceof Error
      && [
        'ERR_CANDIDATE_ALREADY_PROMOTED',
        'ERR_CANDIDATE_PRIVATE_PREVIEW_REQUIRED',
        'ERR_CANDIDATE_STATE_CONFLICT',
      ].includes(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('POST /api/uploads/skill-effect error:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
