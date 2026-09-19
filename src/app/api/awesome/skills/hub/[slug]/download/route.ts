import { NextResponse } from 'next/server'
import { SkillHubError } from '@/modules/agent-skill-hub/bundle'
import { findHubDownload, hubActor } from '@/modules/agent-skill-hub/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const version = new URL(request.url).searchParams.get('version')
    if (version && !/^1\.0\.\d{1,6}$/.test(version)) {
      throw new SkillHubError('ERR_SKILL_HUB_NOT_FOUND', 404)
    }
    const file = await findHubDownload(params.slug, version, await hubActor(request))
    return new NextResponse(new Uint8Array(file.archive), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${file.name}-${file.version}.zip"`,
        'Content-Length': String(file.archive.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': file.public && version
          ? 'public, max-age=31536000, immutable'
          : 'private, no-store',
        'X-Skill-Archive-SHA256': file.archiveHash,
      },
    })
  } catch (error) {
    if (error instanceof SkillHubError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    console.error('Skill Hub download failed:', error)
    return NextResponse.json({ error: 'ERR_SKILL_HUB_UNAVAILABLE' }, { status: 500 })
  }
}
