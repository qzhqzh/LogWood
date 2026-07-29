import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import * as z from 'zod'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  CandidateIdeaError,
  buildCandidateIdeaKey,
  createCandidate,
  findCandidateDuplicate,
  generateCandidateIdea,
} from '@/modules/candidate'
import { assessContent } from '@/modules/like'
import { checkAndConsume } from '@/modules/rate-limit'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  input: z.string().trim().min(2).max(2000),
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const validated = requestSchema.parse(await request.json())
    const limit = await checkAndConsume('candidate_idea_create', {
      actorType: 'user',
      actorKey: `user:${session.user.id}`,
      userId: session.user.id,
    })

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'ERR_RATE_LIMIT_EXCEEDED', resetAt: limit.resetAt.toISOString() },
        { status: 429 },
      )
    }

    const idea = await generateCandidateIdea(validated.input)
    if (assessContent([idea.title, idea.summary, ...idea.tags].join('\n')).flagged) {
      return NextResponse.json({ error: 'ERR_IDEA_CONTENT_REJECTED' }, { status: 400 })
    }

    const ideaKey = buildCandidateIdeaKey({ ...idea, rawInput: validated.input })
    const duplicate = await findCandidateDuplicate({
      ideaKey,
      title: idea.title,
      sourceUrl: idea.sourceUrl,
      authorUserId: session.user.id,
    })

    if (duplicate) {
      return NextResponse.json({ candidate: duplicate, created: false })
    }

    let candidate
    try {
      candidate = await createCandidate({
        title: idea.title,
        ideaKey,
        summary: idea.summary,
        sourceUrl: idea.sourceUrl,
        websiteUrl: idea.websiteUrl,
        tags: idea.tags,
      }, session.user.id)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const racedDuplicate = await findCandidateDuplicate({
          ideaKey,
          title: idea.title,
          sourceUrl: idea.sourceUrl,
          authorUserId: session.user.id,
        })
        if (racedDuplicate) {
          return NextResponse.json({ candidate: racedDuplicate, created: false })
        }
      }
      throw error
    }

    revalidatePath('/candidates')
    revalidatePath('/')
    return NextResponse.json({ candidate, created: true }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_IDEA_INPUT', details: error.errors },
        { status: 400 },
      )
    }
    if (error instanceof CandidateIdeaError) {
      const status = error.code === 'ERR_IDEA_AI_NOT_CONFIGURED'
        || error.code === 'ERR_IDEA_AI_AUTH'
        ? 503
        : 502
      return NextResponse.json({ error: error.code }, { status })
    }

    logger.error('candidate.idea.failed', {
      userId: session.user.id,
      error: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json({ error: 'ERR_IDEA_CREATE_FAILED' }, { status: 500 })
  }
}
