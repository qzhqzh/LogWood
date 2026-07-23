import { prisma } from '@/lib/prisma'
import type { EvaluationSubjectType } from './service'

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
