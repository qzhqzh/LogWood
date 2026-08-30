import path from 'node:path'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import * as z from 'zod'
import { authOptions } from '@/lib/auth'
import { fileMatchesMime } from '@/lib/file-signature'
import { logger } from '@/lib/logger'
import {
  candidatePreviewClientUrl,
  persistPrivateCandidatePreview,
} from '@/lib/private-candidate-preview'
import { createCandidate } from '@/modules/candidate'
import { assessContent } from '@/modules/like'
import { checkAndConsume } from '@/modules/rate-limit'

export const dynamic = 'force-dynamic'

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const MAX_REQUEST_BYTES = 11 * 1024 * 1024
const MAX_INPUT_PIXELS = 40_000_000
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'webp',
  'image/png': 'webp',
  'image/webp': 'webp',
}

const fieldsSchema = z.object({
  title: z.string().trim().min(2).max(120),
  note: z.string().trim().max(1000).optional(),
  prompt: z.string().trim().max(50000).optional(),
  privateDraft: z.enum(['0', '1']).default('0').transform((value) => value === '1'),
  tags: z.string().transform((value, context) => {
    const tags = Array.from(new Set(
      value
        .split(/[,，\n]/)
        .map((tag) => tag.trim().replace(/^#+/, ''))
        .filter(Boolean),
    ))
    if (tags.length > 8 || tags.some((tag) => tag.length > 30)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tags 最多 8 个，每个不超过 30 字',
      })
      return z.NEVER
    }
    return tags
  }),
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  }

  let absolutePath: string | undefined
  try {
    const contentLengthHeader = request.headers.get('content-length')
    if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader)) {
      return NextResponse.json({ error: 'ERR_IMAGE_SIZE' }, { status: 411 })
    }
    const contentLength = Number(contentLengthHeader)
    if (contentLength <= 0 || contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'ERR_IMAGE_SIZE' }, { status: 413 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ERR_IMAGE_REQUIRED' }, { status: 400 })
    }

    const ext = EXTENSION_BY_MIME[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'ERR_IMAGE_TYPE' }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'ERR_IMAGE_SIZE' }, { status: 400 })
    }

    const fields = fieldsSchema.parse({
      title: form.get('title'),
      note: form.get('note') || undefined,
      prompt: form.get('prompt') || undefined,
      privateDraft: form.get('privateDraft') || '0',
      tags: form.get('tags') || '',
    })
    if (assessContent([
      fields.title,
      fields.note,
      fields.prompt,
      ...fields.tags,
    ].filter(Boolean).join('\n')).flagged) {
      return NextResponse.json({ error: 'ERR_IMAGE_CONTENT_REJECTED' }, { status: 400 })
    }
    const limit = await checkAndConsume('candidate_idea_create', {
      actorType: 'user',
      actorKey: `user:${session.user.id}`,
      userId: session.user.id,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'ERR_RATE_LIMIT_EXCEEDED', resetAt: limit.resetAt.toISOString() },
        { status: 429 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!fileMatchesMime(buffer.subarray(0, 32), file.type)) {
      return NextResponse.json({ error: 'ERR_IMAGE_SIGNATURE' }, { status: 400 })
    }

    let safeBuffer: Buffer
    try {
      safeBuffer = await sharp(buffer, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize({
          width: 4096,
          height: 4096,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 86 })
        .toBuffer()
    } catch {
      return NextResponse.json({ error: 'ERR_IMAGE_INVALID' }, { status: 400 })
    }

    const fileName = `${Date.now()}-${randomUUID()}.${ext}`
    let previewImageUrl: string
    if (fields.privateDraft) {
      const location = await persistPrivateCandidatePreview({ fileName, buffer: safeBuffer })
      absolutePath = location.absolutePath
      previewImageUrl = location.reference
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'candidates')
      absolutePath = path.join(uploadDir, fileName)
      await mkdir(uploadDir, { recursive: true })
      await writeFile(absolutePath, safeBuffer)
      previewImageUrl = `/uploads/candidates/${fileName}`
    }

    const candidate = await createCandidate({
      title: fields.title,
      summary: fields.note,
      rawContent: fields.prompt,
      previewImageUrl,
      tags: fields.tags,
      visibility: fields.privateDraft ? 'private' : 'public',
    }, session.user.id)
    // Once the database points at this file, rollback must stop. Revalidation
    // failures must never leave an existing Candidate with a missing preview.
    absolutePath = undefined

    revalidatePath('/candidates')
    revalidatePath('/workbench')
    return NextResponse.json({
      candidate: {
        ...candidate,
        previewImageUrl: candidatePreviewClientUrl(candidate.id, candidate.previewImageUrl),
      },
    }, { status: 201 })
  } catch (error) {
    if (absolutePath) {
      await unlink(absolutePath).catch(() => undefined)
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_IMAGE_FIELDS', details: error.errors },
        { status: 400 },
      )
    }
    logger.error('candidate.image.failed', {
      userId: session.user.id,
      error: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json({ error: 'ERR_IMAGE_CREATE_FAILED' }, { status: 500 })
  }
}
