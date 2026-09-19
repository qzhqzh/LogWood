import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import {
  createManagedAgentSkill,
  isSkillCatalogSlugConflict,
  listManagedAgentSkills,
  managedSkillInputSchema,
  managedSkillUpdateSchema,
  updateManagedAgentSkill,
} from '@/modules/candidate/skill-catalog-management'

export const dynamic = 'force-dynamic'

async function authorizedAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.id && isAdminSession(session) ? session.user.id : null
}

function refreshIndex() {
  revalidatePath('/awesome/skills')
  revalidatePath('/awesome/skills/manage')
}

function failure(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'ERR_SKILL_CATALOG_VALIDATION', details: error.flatten() }, { status: 400 })
  }
  if (isSkillCatalogSlugConflict(error)) {
    return NextResponse.json({ error: 'ERR_SKILL_CATALOG_DUPLICATE' }, { status: 409 })
  }
  if (error instanceof Error && error.message.startsWith('ERR_SKILL_CATALOG_')) {
    const code = error.message
    const status = code === 'ERR_SKILL_CATALOG_NOT_FOUND' ? 404 : 409
    return NextResponse.json({ error: code }, { status })
  }
  console.error('Agent Skill catalog management error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  if (!await authorizedAdmin()) return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
  try {
    const skills = await listManagedAgentSkills()
    if (new URL(request.url).searchParams.get('export') === '1') {
      return NextResponse.json({ schema: 'logwood.skill-catalog.export.v1', skills }, {
        headers: {
          'Content-Disposition': 'attachment; filename="logwood-agent-skills.json"',
          'Cache-Control': 'private, no-store',
        },
      })
    }
    return NextResponse.json({ skills }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: NextRequest) {
  const adminId = await authorizedAdmin()
  if (!adminId) return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
  try {
    const skill = await createManagedAgentSkill(managedSkillInputSchema.parse(await request.json()), adminId)
    refreshIndex()
    return NextResponse.json({ skill }, { status: 201 })
  } catch (error) {
    return failure(error)
  }
}

export async function PATCH(request: NextRequest) {
  if (!await authorizedAdmin()) return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
  try {
    const skill = await updateManagedAgentSkill(managedSkillUpdateSchema.parse(await request.json()))
    refreshIndex()
    return NextResponse.json({ skill })
  } catch (error) {
    return failure(error)
  }
}
