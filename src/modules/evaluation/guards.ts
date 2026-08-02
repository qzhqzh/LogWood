import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { EvaluationSubjectType } from './service'

type HistoryGuardDb = Pick<Prisma.TransactionClient, 'evaluation' | 'review'>

/**
 * Formal evaluations are evidence records. A subject cannot be physically
 * deleted while Evaluation rows still reference it; archive or migrate those
 * evaluations first. The database relation also uses onDelete=Restrict as the
 * final safety net.
 */
export async function assertNoEvaluationsForSubject(
  subjectType: EvaluationSubjectType,
  subjectId: string,
): Promise<void> {
  const where = subjectType === 'target'
    ? { targetId: subjectId }
    : subjectType === 'skill'
      ? { skillId: subjectId }
      : subjectType === 'app'
        ? { appId: subjectId }
        : { candidateId: subjectId }

  const count = await prisma.evaluation.count({ where })
  if (count > 0) {
    throw new Error('ERR_SUBJECT_HAS_EVALUATIONS')
  }
}

/**
 * Reviews own comments and likes through cascading relations. Physical subject
 * deletion is therefore only safe when neither formal evidence nor free-form
 * history exists. Lifecycle changes should use status/archive fields instead.
 */
export async function assertNoHistoryForSubject(
  subjectType: EvaluationSubjectType,
  subjectId: string,
  db: HistoryGuardDb = prisma,
): Promise<void> {
  const where = subjectType === 'target'
    ? { targetId: subjectId }
    : subjectType === 'skill'
      ? { skillId: subjectId }
      : subjectType === 'app'
        ? { appId: subjectId }
        : { candidateId: subjectId }

  const [evaluationCount, reviewCount] = await Promise.all([
    db.evaluation.count({ where }),
    db.review.count({ where }),
  ])

  if (evaluationCount > 0 || reviewCount > 0) {
    throw new Error('ERR_SUBJECT_HAS_HISTORY')
  }
}

async function lockSubject(
  tx: Prisma.TransactionClient,
  subjectType: EvaluationSubjectType,
  subjectId: string,
) {
  if (subjectType === 'target') {
    await tx.$queryRaw`SELECT "id" FROM "targets" WHERE "id" = ${subjectId} FOR UPDATE`
  } else if (subjectType === 'skill') {
    await tx.$queryRaw`SELECT "id" FROM "skills" WHERE "id" = ${subjectId} FOR UPDATE`
  } else if (subjectType === 'app') {
    await tx.$queryRaw`SELECT "id" FROM "apps" WHERE "id" = ${subjectId} FOR UPDATE`
  } else {
    await tx.$queryRaw`SELECT "id" FROM "candidates" WHERE "id" = ${subjectId} FOR UPDATE`
  }
}

export async function deleteSubjectWithHistoryGuard<T>(
  subjectType: EvaluationSubjectType,
  subjectId: string,
  deleteSubject: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // The row lock prevents a concurrent Review insert from landing between
    // the history check and the physical delete.
    await lockSubject(tx, subjectType, subjectId)
    await assertNoHistoryForSubject(subjectType, subjectId, tx)
    return deleteSubject(tx)
  })
}
