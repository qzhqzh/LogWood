import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { APP_STATUSES, createApp, listAllAppsForManage, listApps, updateApp } from '@/modules/app'

export const dynamic = 'force-dynamic'

const createAppSchema = z.object({
  name: z.string().min(2).max(80),
  appUrl: z.string().url(),
  title: z.string().min(2).max(120),
  summary: z.string().min(10).max(240),
  description: z.string().min(20).max(10000),
  previewImageUrl: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().url().optional()
  ),
  tags: z.array(z.string().min(1).max(30)).optional(),
  status: z.enum(APP_STATUSES).optional(),
})

type CreateAppPayload = z.infer<typeof createAppSchema>

const updateAppSchema = createAppSchema.extend({
  id: z.string().min(1),
})

type UpdateAppPayload = z.infer<typeof updateAppSchema>

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const manage = searchParams.get('manage') === 'true'

    if (manage) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
      }

      const apps = await listAllAppsForManage()
      return NextResponse.json({ apps })
    }

    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '12')
    const result = await listApps({ page, pageSize, status: 'published' })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/apps error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json()
    const validated: CreateAppPayload = createAppSchema.parse(body)
    const app = await createApp(validated, session.user.id)

    return NextResponse.json(app, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_APP_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    console.error('POST /api/apps error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json()
    const validated: UpdateAppPayload = updateAppSchema.parse(body)
    const app = await updateApp(validated)

    return NextResponse.json(app)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_APP_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'ERR_APP_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('PATCH /api/apps error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
