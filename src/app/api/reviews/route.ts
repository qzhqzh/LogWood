import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { createReview, getReviews } from '@/modules/review'
import { parsePage, parsePageSize } from '@/lib/safe-parse'
import { z } from 'zod'

const subjectTypeSchema = z.enum(['target', 'skill', 'app', 'candidate'])

const createReviewSchema = z
  .object({
    subjectType: subjectTypeSchema.optional(),
    subjectId: z.string().min(1).optional(),
    targetId: z.string().min(1).optional(),
    skillId: z.string().min(1).optional(),
    appId: z.string().min(1).optional(),
    candidateId: z.string().min(1).optional(),
    rating: z.number().int().min(1).max(5),
    content: z.string().min(3).max(2000),
    language: z.string().optional(),
    deviceFingerprint: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const ids = [data.targetId, data.skillId, data.appId, data.candidateId].filter(Boolean)
    const hasPair = Boolean(data.subjectType && data.subjectId)
    if (!hasPair && ids.length !== 1 && !data.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '必须指定一个评测对象',
      })
    }
  })

function normalizeCreateBody(data: z.infer<typeof createReviewSchema>) {
  if (data.subjectType && data.subjectId) {
    return {
      subjectType: data.subjectType,
      subjectId: data.subjectId,
      rating: data.rating,
      content: data.content,
      language: data.language,
    }
  }
  if (data.skillId) {
    return { subjectType: 'skill' as const, subjectId: data.skillId, rating: data.rating, content: data.content, language: data.language }
  }
  if (data.appId) {
    return { subjectType: 'app' as const, subjectId: data.appId, rating: data.rating, content: data.content, language: data.language }
  }
  if (data.candidateId) {
    return { subjectType: 'candidate' as const, subjectId: data.candidateId, rating: data.rating, content: data.content, language: data.language }
  }
  return {
    subjectType: 'target' as const,
    subjectId: data.targetId!,
    rating: data.rating,
    content: data.content,
    language: data.language,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = {
      sort: searchParams.get('sort') as 'latest' | 'hot' | undefined,
      targetId: searchParams.get('targetId') || undefined,
      skillId: searchParams.get('skillId') || undefined,
      appId: searchParams.get('appId') || undefined,
      candidateId: searchParams.get('candidateId') || undefined,
      language: searchParams.get('language') || undefined,
      page: parsePage(searchParams.get('page')),
      pageSize: parsePageSize(searchParams.get('pageSize')),
    }

    const actor = await resolveActorWithFingerprint(
      searchParams.get('fingerprint') || undefined
    )

    const result = await getReviews(query, actor)

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/reviews error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createReviewSchema.parse(body)
    const normalized = normalizeCreateBody(validated)

    const actor = await resolveActorWithFingerprint(validated.deviceFingerprint, { createIfMissing: true })

    const result = await createReview(normalized, actor)

    revalidatePath('/')
    revalidatePath('/candidates')
    revalidatePath('/skills')
    revalidatePath('/app')
    revalidatePath('/tools')
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_REVIEW_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'ERR_RATE_LIMIT_EXCEEDED') {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        )
      }
      if (
        error.message === 'ERR_TARGET_NOT_FOUND' ||
        error.message === 'ERR_SKILL_NOT_FOUND' ||
        error.message === 'ERR_APP_NOT_FOUND' ||
        error.message === 'ERR_CANDIDATE_NOT_FOUND'
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
      if (error.message === 'ERR_REVIEW_VALIDATION') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    console.error('POST /api/reviews error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
