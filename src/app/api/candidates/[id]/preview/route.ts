import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import {
  privateCandidatePreviewMime,
  privateCandidatePreviewPath,
} from '@/lib/private-candidate-preview'
import { getCandidateById } from '@/modules/candidate'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Disposition': 'inline; filename="candidate-preview"',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new NextResponse(null, { status: 404 })

  const candidate = await getCandidateById(params.id)
  if (
    !candidate
    || candidate.visibility !== 'private'
    || (!isAdminSession(session) && candidate.authorUserId !== session.user.id)
  ) {
    return new NextResponse(null, { status: 404 })
  }

  const absolutePath = privateCandidatePreviewPath(candidate.previewImageUrl)
  const contentType = candidate.previewImageUrl
    ? privateCandidatePreviewMime(candidate.previewImageUrl)
    : null
  if (!absolutePath || !contentType) return new NextResponse(null, { status: 404 })

  try {
    const image = await readFile(absolutePath)
    return new NextResponse(image, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(image.byteLength),
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
