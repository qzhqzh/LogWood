import { prisma } from '@/lib/prisma'
import { ReportTargetType, ReportStatus, ReviewStatus, CommentStatus } from '@prisma/client'
import { ActorContext } from '@/modules/identity'
import { checkAndConsume } from '@/modules/rate-limit'

export interface CreateReportInput {
  targetType: ReportTargetType
  targetId: string
  reason: string
}

const AUTO_HIDE_THRESHOLD = 5

export async function createReport(
  input: CreateReportInput,
  actor: ActorContext
): Promise<{ id: string; status: ReportStatus }> {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new Error('ERR_REPORT_VALIDATION')
  }

  let targetExists = false

  if (input.targetType === ReportTargetType.review) {
    const review = await prisma.review.findUnique({
      where: { id: input.targetId },
      select: { id: true, status: true },
    })
    targetExists = !!review && review.status !== ReviewStatus.deleted
  } else if (input.targetType === ReportTargetType.comment) {
    const comment = await prisma.comment.findUnique({
      where: { id: input.targetId },
      select: { id: true, status: true },
    })
    targetExists = !!comment && comment.status !== CommentStatus.deleted
  }

  if (!targetExists) {
    throw new Error('ERR_REPORT_TARGET_NOT_FOUND')
  }

  const rateLimitResult = await checkAndConsume('report_create', actor)
  if (!rateLimitResult.allowed) {
    throw new Error('ERR_RATE_LIMIT_EXCEEDED')
  }

  const report = await prisma.report.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason.trim(),
      reporterUserId: actor.userId,
      reporterAnonymousId: actor.anonymousUserId,
      status: ReportStatus.open,
    },
  })

  await applyAutoHideIfThresholdReached(input.targetType, input.targetId)

  return {
    id: report.id,
    status: report.status,
  }
}

export async function applyAutoHideIfThresholdReached(
  targetType: ReportTargetType,
  targetId: string
): Promise<boolean> {
  const openReportsCount = await prisma.report.count({
    where: {
      targetType,
      targetId,
      status: ReportStatus.open,
    },
  })

  if (openReportsCount >= AUTO_HIDE_THRESHOLD) {
    if (targetType === ReportTargetType.review) {
      await prisma.review.update({
        where: { id: targetId },
        data: { status: ReviewStatus.hidden, reportsCount: openReportsCount },
      })
    } else if (targetType === ReportTargetType.comment) {
      await prisma.comment.update({
        where: { id: targetId },
        data: { status: CommentStatus.hidden, reportsCount: openReportsCount },
      })
    }
    return true
  }

  if (targetType === ReportTargetType.review) {
    await prisma.review.update({
      where: { id: targetId },
      data: { reportsCount: openReportsCount },
    })
  } else if (targetType === ReportTargetType.comment) {
    await prisma.comment.update({
      where: { id: targetId },
      data: { reportsCount: openReportsCount },
    })
  }

  return false
}

export async function getReports(
  status?: ReportStatus,
  page: number = 1,
  pageSize: number = 20
) {
  const where = status ? { status } : {}

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true } },
        anonymousUser: { select: { id: true, displayName: true } },
      },
    }),
    prisma.report.count({ where }),
  ])

  return {
    reports: reports.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      reporter: report.user
        ? { type: 'user' as const, name: report.user.name || 'User' }
        : { type: 'anonymous' as const, name: report.anonymousUser?.displayName || '匿名用户' },
    })),
    total,
  }
}

export async function resolveReport(
  reportId: string,
  action: 'resolve' | 'reject'
): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
  })

  if (!report) {
    throw new Error('ERR_REPORT_NOT_FOUND')
  }

  const newStatus = action === 'resolve' ? ReportStatus.resolved : ReportStatus.rejected

  await prisma.report.update({
    where: { id: reportId },
    data: { status: newStatus },
  })

  if (action === 'resolve' && report.status === ReportStatus.open) {
    if (report.targetType === ReportTargetType.review) {
      await prisma.review.update({
        where: { id: report.targetId },
        data: { status: ReviewStatus.hidden },
      })
    } else if (report.targetType === ReportTargetType.comment) {
      await prisma.comment.update({
        where: { id: report.targetId },
        data: { status: CommentStatus.hidden },
      })
    }
  }
}
