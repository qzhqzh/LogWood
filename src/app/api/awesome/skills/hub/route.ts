import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  bundleFromForm, MAX_FILES, readLimitedMultipart, SkillHubError,
} from '@/modules/agent-skill-hub/bundle'
import { hubActor, listMyHubSkills, listPublishedHubSkills, submitHubSkill } from '@/modules/agent-skill-hub/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  if (error instanceof SkillHubError) {
    return NextResponse.json({ error: error.code }, { status: error.status })
  }
  console.error('Skill Hub publish failed:', error)
  return NextResponse.json({ error: 'ERR_SKILL_HUB_UNAVAILABLE' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const mine = new URL(request.url).searchParams.get('mine') === '1'
    if (mine) {
      const actor = await hubActor(request)
      if (!actor) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
      return NextResponse.json({ skills: await listMyHubSkills(actor.userId) }, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }
    return NextResponse.json({ skills: await listPublishedHubSkills() }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await hubActor(request)
    if (!actor) return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) {
      throw new SkillHubError('ERR_SKILL_HUB_FILE_COUNT')
    }
    const form = await readLimitedMultipart(request)
    if (form.getAll('file').length > MAX_FILES) throw new SkillHubError('ERR_SKILL_HUB_FILE_COUNT')
    const bundle = await bundleFromForm(form)
    const changelog = form.get('changelog')
    if (typeof changelog !== 'string') throw new SkillHubError('ERR_SKILL_HUB_CHANGELOG')
    const result = await submitHubSkill(actor.userId, bundle, changelog)
    if (!result.unchanged) {
      revalidatePath('/awesome/skills')
      revalidatePath('/awesome/skills/hub')
    }
    return NextResponse.json(result, {
      status: result.unchanged ? 200 : 201,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
