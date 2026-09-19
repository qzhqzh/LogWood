import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { SkillHubError } from '@/modules/agent-skill-hub/bundle'
import { reviewHubSkill } from '@/modules/agent-skill-hub/service'

export const dynamic = 'force-dynamic'

const schema = z.object({ approve: z.boolean(), note: z.string().trim().max(1000).default('') })

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
  }
  try {
    const { approve, note } = schema.parse(await request.json())
    const release = await reviewHubSkill(params.id, session.user.id, approve, note)
    revalidatePath('/awesome/skills')
    revalidatePath('/awesome/skills/hub')
    return NextResponse.json({ status: release.status }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof SkillHubError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_SKILL_HUB_VALIDATION' }, { status: 400 })
    }
    console.error('Skill Hub review failed:', error)
    return NextResponse.json({ error: 'ERR_SKILL_HUB_UNAVAILABLE' }, { status: 500 })
  }
}
