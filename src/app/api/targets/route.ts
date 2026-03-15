import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { listTargets, getTargetBySlug, getFeatures } from '@/modules/target'
import { TargetType } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createTarget, updateTarget, deleteTarget } from '@/modules/target'
import { isAdminSession } from '@/lib/authz'

export const dynamic = 'force-dynamic'

const createTargetSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.nativeEnum(TargetType),
  logoUrl: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().url().optional()
  ),
  description: z.string().max(240).optional(),
  websiteUrl: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().url().optional()
  ),
  developer: z.string().max(80).optional(),
  features: z.array(z.string().min(1).max(30)).optional(),
})

const updateTargetSchema = createTargetSchema.extend({
  id: z.string().min(1),
})

const deleteTargetSchema = z.object({
  id: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as TargetType | null
    const feature = searchParams.get('feature')
    const slug = searchParams.get('slug')
    const features = searchParams.get('features') === 'true'

    if (features) {
      const featureList = await getFeatures()
      return NextResponse.json({ features: featureList })
    }

    if (type && slug) {
      const target = await getTargetBySlug(type, slug)
      if (!target) {
        return NextResponse.json(
          { error: 'ERR_TARGET_NOT_FOUND' },
          { status: 404 }
        )
      }
      return NextResponse.json({ target })
    }

    const filter: { type?: TargetType; feature?: string } = {}
    if (type && (type === 'editor' || type === 'coding' || type === 'model' || type === 'prompt')) {
      filter.type = type
    }
    if (feature) {
      filter.feature = feature
    }

    const targets = await listTargets(Object.keys(filter).length > 0 ? filter : undefined)

    return NextResponse.json({ targets })
  } catch (error) {
    console.error('GET /api/targets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    const body = await request.json()
    const validated = createTargetSchema.parse(body)
    const result = await createTarget(validated)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_TARGET_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    console.error('POST /api/targets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    const body = await request.json()
    const validated = updateTargetSchema.parse(body)
    const result = await updateTarget(validated)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_TARGET_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'ERR_TARGET_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('PATCH /api/targets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    const body = await request.json()
    const validated = deleteTargetSchema.parse(body)
    const result = await deleteTarget(validated.id)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_TARGET_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'ERR_TARGET_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('DELETE /api/targets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
