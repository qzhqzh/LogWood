import { NextRequest, NextResponse } from 'next/server'
import { resolveActorWithFingerprint } from '@/modules/identity'
import { createReport } from '@/modules/moderation'
import { ReportTargetType } from '@prisma/client'
import { z } from 'zod'

const createReportSchema = z.object({
  targetType: z.enum(['review', 'comment']),
  targetId: z.string(),
  reason: z.string().min(5).max(500),
  deviceFingerprint: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createReportSchema.parse(body)

    const actor = await resolveActorWithFingerprint(validated.deviceFingerprint)

    const result = await createReport(
      {
        targetType: validated.targetType as ReportTargetType,
        targetId: validated.targetId,
        reason: validated.reason,
      },
      actor
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_REPORT_VALIDATION', details: error.errors },
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
      if (error.message === 'ERR_REPORT_TARGET_NOT_FOUND') {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }

    console.error('POST /api/reports error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
