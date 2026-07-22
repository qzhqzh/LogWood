import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { SkillStatus } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import {
  createSkill,
  deleteSkill,
  listAllSkillsForAdmin,
  listSkillsGrouped,
  updateSkill,
} from '@/modules/skill'

export const dynamic = 'force-dynamic'

const optionalAssetUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed
}, z.string().refine(
  (v) => /^https?:\/\//i.test(v) || v.startsWith('/'),
  { message: '必须是 http(s) URL 或 / 开头的路径' },
).optional())

const optionalHttpUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}, z.string().url().optional())

const skillBodySchema = z.object({
  title: z.string().min(2).max(120),
  category: z.string().min(1).max(40),
  summary: z.string().max(240).optional(),
  prompt: z.string().min(8).max(50000),
  effectImageUrl: optionalAssetUrl,
  effectNote: z.string().max(500).optional(),
  sourceUrl: optionalHttpUrl,
  tags: z.array(z.string().min(1).max(30)).optional(),
  status: z.nativeEnum(SkillStatus).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

const updateSchema = skillBodySchema.extend({ id: z.string().min(1) })
const deleteSchema = z.object({ id: z.string().min(1) })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const admin = searchParams.get('admin') === '1'
    const category = searchParams.get('category') || undefined

    if (admin) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id || !isAdminSession(session)) {
        return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
      }
      const skills = await listAllSkillsForAdmin()
      return NextResponse.json({ skills })
    }

    const groups = await listSkillsGrouped(category)
    return NextResponse.json({ groups })
  } catch (error) {
    console.error('GET /api/skills error:', error)
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

    const validated = skillBodySchema.parse(await request.json())
    const skill = await createSkill(validated, session.user.id)
    revalidatePath('/skills')
    revalidatePath('/')
    return NextResponse.json({ skill }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_SKILL_VALIDATION', details: error.errors }, { status: 400 })
    }
    console.error('POST /api/skills error:', error)
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

    const validated = updateSchema.parse(await request.json())
    const skill = await updateSkill(validated)
    revalidatePath('/skills')
    revalidatePath(`/skills/${skill.slug}`)
    revalidatePath('/')
    return NextResponse.json({ skill })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_SKILL_VALIDATION', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ERR_SKILL_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('PATCH /api/skills error:', error)
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

    const validated = deleteSchema.parse(await request.json())
    const result = await deleteSkill(validated.id)
    revalidatePath('/skills')
    revalidatePath('/')
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_SKILL_VALIDATION', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'ERR_SKILL_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('DELETE /api/skills error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
