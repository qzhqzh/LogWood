import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { setAwesomeInterest } from '@/modules/candidate'
import { resolveActorWithFingerprint } from '@/modules/identity'

const interestSchema = z.object({
  score: z.number().int().min(1).max(5),
  deviceFingerprint: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const input = interestSchema.parse(await request.json())
    const actor = await resolveActorWithFingerprint(input.deviceFingerprint, {
      createIfMissing: true,
    })
    const interest = await setAwesomeInterest(slug, input.score, actor)

    revalidatePath('/awesome')
    revalidatePath('/awesome/skills')
    return NextResponse.json({ interest })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ERR_INTEREST_SCORE_INVALID' }, { status: 400 })
    }
    if (error instanceof Error) {
      if (error.message === 'ERR_INTEREST_SCORE_INVALID') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message === 'ERR_INTEREST_IDENTITY_REQUIRED') {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === 'ERR_AWESOME_PROJECT_NOT_FOUND') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'ERR_RATE_LIMIT_EXCEEDED') {
        return NextResponse.json({ error: error.message }, { status: 429 })
      }
    }

    console.error('POST /api/awesome/[slug]/interest error:', error)
    return NextResponse.json({ error: 'ERR_AWESOME_UNAVAILABLE' }, { status: 500 })
  }
}
