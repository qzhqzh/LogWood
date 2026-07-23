import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TargetType } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { recordAdminAction } from '@/modules/audit'
import { assertNoEvaluationsForSubject } from '@/modules/evaluation'
import {
  createTarget,
  deleteTarget,
  getFeatures,
  getTargetBySlug,
  listTargets,
  updateTarget,
} from '@/modules/target'

export const dynamic = 'force-dynamic'

const optionalHttpUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}, z.string().url().optional())

const optionalAssetUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed
}, z.string().refine(
  (value) => /^https?:\/\//i.test(value) || value.startsWith('/'),
  { message: '必须是 http(s) URL 或 / 开头的路径' },
).optional())

const optionalDescription = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed || undefined
}, z.string().max(2000).optional())

const createTargetSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.nativeEnum(TargetType),
  logoUrl: optionalHttpUrl,
  description: optionalDescription,
  websiteUrl: optionalHttpUrl,
  developer: z.string().max(80).optional(),
  features: z.array(z.string().min(1).max(30)).optional(),
  previewImageUrl: optionalAssetUrl,
  sourceUrl: optionalHttpUrl,
  compareGroup: z.string().max(80).optional(),
})

const updateTargetSchema = createTargetSchema.extend({ id: z.string().min(1) })
const deleteTargetSchema = z.object({ id: z.string().min(1) })

function revalidateTargetLists() {
  revalidatePath('/editor')
  revalidatePath('/skills')
  revalidatePath('/coding')
  revalidatePath('/tools')
  revalidatePath('/')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as TargetType | null
    const feature = searchParams.get('feature')
    const slug = searchParams.get('slug')
    const features = searchParams.get('features') === 'true'

    if (features) {
      return NextResponse.json({ features: await getFeatures() })
    }

    if (type && slug) {
      const target = await getTargetBySlug(type, slug)
      if (!target) {
        return NextResponse.json({ error: 'ERR_TARGET_NOT_FOUND' }, { status: 404 })
      }
      return NextResponse.json({ target })
    }

    const filter: { type?: TargetType; feature?: string } = {}
    if (type && Object.values(TargetType).includes(type)) filter.type = type
    if (feature) filter.feature = feature

    return NextResponse.json({
      targets: await listTargets(Object.keys(filter).length > 0 ? filter : undefined),
    })
  } catch (error) {
    console.error('GET /api/targets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const validated = createTargetSchema.parse(await request.json())
    const result = await createTarget(validated)
    revalidateTargetLists()
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_TARGET_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    console.error('POST /api/targets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const validated = updateTargetSchema.parse(await request.json())
    const result = await updateTarget(validated)

    await recordAdminAction({
      actorUserId: session.user.id,
      action: 'target.update',
      targetType: 'target',
      targetId: validated.id,
      metadata: { name: validated.name, type: validated.type },
    })

    revalidateTargetLists()
    revalidatePath(`/${validated.type}/${result.slug}`)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_TARGET_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'ERR_TARGET_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('PATCH /api/targets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
    }

    const validated = deleteTargetSchema.parse(await request.json())
    await assertNoEvaluationsForSubject('target', validated.id)
    const result = await deleteTarget(validated.id)

    await recordAdminAction({
      actorUserId: session.user.id,
      action: 'target.delete',
      targetType: 'target',
      targetId: validated.id,
    })

    revalidateTargetLists()
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_TARGET_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'ERR_TARGET_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'ERR_SUBJECT_HAS_EVALUATIONS') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('DELETE /api/targets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
