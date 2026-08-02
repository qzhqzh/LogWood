import { CandidatePromoteTo, CandidateStatus, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type PromotionField = 'promotedTargetId' | 'promotedSkillId' | 'promotedAppId'
type SubjectField = 'targetId' | 'skillId' | 'appId' | 'candidateId'

interface AuditIssue {
  entityType: 'candidate' | 'review' | 'evaluation'
  entityId: string
  slug?: string
  code:
    | 'PROMOTED_WITHOUT_TYPE'
    | 'PROMOTED_WITHOUT_DESTINATION'
    | 'PROMOTION_TYPE_MISMATCH'
    | 'MULTIPLE_DESTINATIONS'
    | 'MISSING_DESTINATION'
    | 'STALE_PROMOTION_METADATA'
    | 'DUPLICATE_DESTINATION'
    | 'SUBJECT_CARDINALITY'
    | 'MISSING_SUBJECT'
  detail: string
}

interface SubjectReference {
  id: string
  targetId: string | null
  skillId: string | null
  appId: string | null
  candidateId: string | null
}

const promotionFieldByType: Record<CandidatePromoteTo, PromotionField> = {
  [CandidatePromoteTo.tool]: 'promotedTargetId',
  [CandidatePromoteTo.skill]: 'promotedSkillId',
  [CandidatePromoteTo.gallery]: 'promotedAppId',
}

async function main() {
  const snapshot = await prisma.$transaction(async (tx) => {
    const [
      candidates,
      targets,
      skills,
      apps,
      reviews,
      evaluations,
      comments,
      reviewLikes,
      commentLikes,
      articles,
      articleComments,
      articleLikes,
    ] = await Promise.all([
      tx.candidate.findMany({
        select: {
          id: true,
          slug: true,
          status: true,
          promotedTo: true,
          promotedTargetId: true,
          promotedSkillId: true,
          promotedAppId: true,
        },
      }),
      tx.target.findMany({ select: { id: true, slug: true, type: true } }),
      tx.skill.findMany({ select: { id: true, slug: true } }),
      tx.app.findMany({ select: { id: true, slug: true } }),
      tx.review.findMany({
        select: { id: true, targetId: true, skillId: true, appId: true, candidateId: true },
      }),
      tx.evaluation.findMany({
        select: { id: true, targetId: true, skillId: true, appId: true, candidateId: true },
      }),
      tx.comment.count(),
      tx.reviewLike.count(),
      tx.commentLike.count(),
      tx.article.count(),
      tx.articleComment.count(),
      tx.articleLike.count(),
    ])
    return {
      candidates,
      targets,
      skills,
      apps,
      reviews,
      evaluations,
      comments,
      reviewLikes,
      commentLikes,
      articles,
      articleComments,
      articleLikes,
    }
  }, { isolationLevel: 'RepeatableRead' })

  const destinationIds: Record<PromotionField, Set<string>> = {
    promotedTargetId: new Set(snapshot.targets.map(({ id }) => id)),
    promotedSkillId: new Set(snapshot.skills.map(({ id }) => id)),
    promotedAppId: new Set(snapshot.apps.map(({ id }) => id)),
  }
  const subjectIds: Record<SubjectField, Set<string>> = {
    targetId: destinationIds.promotedTargetId,
    skillId: destinationIds.promotedSkillId,
    appId: destinationIds.promotedAppId,
    candidateId: new Set(snapshot.candidates.map(({ id }) => id)),
  }
  const statusCounts = Object.fromEntries(
    Object.values(CandidateStatus).map((status) => [status, 0]),
  ) as Record<CandidateStatus, number>
  const issues: AuditIssue[] = []
  const destinationOrigins = new Map<string, Array<{ entityId: string; slug: string }>>()

  for (const candidate of snapshot.candidates) {
    statusCounts[candidate.status] += 1
    const populatedDestinations = (Object.keys(destinationIds) as PromotionField[])
      .filter((field) => candidate[field])

    if (candidate.status !== CandidateStatus.promoted) {
      if (candidate.promotedTo || populatedDestinations.length > 0) {
        issues.push({
          entityType: 'candidate',
          entityId: candidate.id,
          slug: candidate.slug,
          code: 'STALE_PROMOTION_METADATA',
          detail: '非已入藏状态仍保留晋升类型或目标。',
        })
      }
      continue
    }

    if (!candidate.promotedTo) {
      issues.push({
        entityType: 'candidate',
        entityId: candidate.id,
        slug: candidate.slug,
        code: 'PROMOTED_WITHOUT_TYPE',
        detail: '已入藏记录缺少 promotedTo。',
      })
    }
    if (populatedDestinations.length === 0) {
      issues.push({
        entityType: 'candidate',
        entityId: candidate.id,
        slug: candidate.slug,
        code: 'PROMOTED_WITHOUT_DESTINATION',
        detail: '已入藏记录没有关联收藏对象。',
      })
    }
    if (populatedDestinations.length > 1) {
      issues.push({
        entityType: 'candidate',
        entityId: candidate.id,
        slug: candidate.slug,
        code: 'MULTIPLE_DESTINATIONS',
        detail: `同时关联 ${populatedDestinations.join(', ')}。`,
      })
    }

    if (candidate.promotedTo) {
      const expectedField = promotionFieldByType[candidate.promotedTo]
      const destinationId = candidate[expectedField]
      if (!destinationId) {
        issues.push({
          entityType: 'candidate',
          entityId: candidate.id,
          slug: candidate.slug,
          code: 'PROMOTION_TYPE_MISMATCH',
          detail: `${candidate.promotedTo} 应使用 ${expectedField}。`,
        })
      } else {
        if (!destinationIds[expectedField].has(destinationId)) {
          issues.push({
            entityType: 'candidate',
            entityId: candidate.id,
            slug: candidate.slug,
            code: 'MISSING_DESTINATION',
            detail: `${expectedField}=${destinationId} 指向不存在的记录。`,
          })
        }
        const key = `${expectedField}:${destinationId}`
        const origins = destinationOrigins.get(key) || []
        origins.push({ entityId: candidate.id, slug: candidate.slug })
        destinationOrigins.set(key, origins)
      }
    }
  }

  destinationOrigins.forEach((origins, destination) => {
    if (origins.length < 2) return
    for (const origin of origins) {
      issues.push({
        entityType: 'candidate',
        ...origin,
        code: 'DUPLICATE_DESTINATION',
        detail: `${origins.length} 条灵感共同指向 ${destination}，来源展示存在歧义。`,
      })
    }
  })

  function auditSubjects(entityType: 'review' | 'evaluation', rows: SubjectReference[]) {
    for (const row of rows) {
      const populated = (Object.keys(subjectIds) as SubjectField[])
        .filter((field) => row[field])
      if (populated.length !== 1) {
        issues.push({
          entityType,
          entityId: row.id,
          code: 'SUBJECT_CARDINALITY',
          detail: `应关联且仅关联一个 Subject，当前为 ${populated.length} 个。`,
        })
        continue
      }
      const field = populated[0]
      const subjectId = row[field] as string
      if (!subjectIds[field].has(subjectId)) {
        issues.push({
          entityType,
          entityId: row.id,
          code: 'MISSING_SUBJECT',
          detail: `${field}=${subjectId} 指向不存在的记录。`,
        })
      }
    }
  }

  auditSubjects('review', snapshot.reviews)
  auditSubjects('evaluation', snapshot.evaluations)

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-repeatable-read',
    totals: {
      candidates: snapshot.candidates.length,
      reviews: snapshot.reviews.length,
      evaluations: snapshot.evaluations.length,
      comments: snapshot.comments,
      reviewLikes: snapshot.reviewLikes,
      commentLikes: snapshot.commentLikes,
      articles: snapshot.articles,
      articleComments: snapshot.articleComments,
      articleLikes: snapshot.articleLikes,
      collection: {
        targets: snapshot.targets.length,
        skills: snapshot.skills.length,
        apps: snapshot.apps.length,
        total: snapshot.targets.length + snapshot.skills.length + snapshot.apps.length,
      },
    },
    candidateStatuses: statusCounts,
    blockers: issues,
    readyForPhase2Backfill: issues.length === 0,
    readyForPhysicalMigration: false,
    remainingPhysicalMigrationGates: [
      '迁移前后总数与互动数量对账',
      '旧详情 URL 的 HTTP 解析实测',
      '备份、事务写入、回滚与恢复演练',
    ],
  }

  console.log(JSON.stringify(report, null, 2))
  if (issues.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error('Lifecycle audit failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
