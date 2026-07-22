export type ReviewSubjectType = 'target' | 'skill' | 'app' | 'candidate'

export const REVIEW_SUBJECT_QUERY_KEY: Record<ReviewSubjectType, string> = {
  target: 'targetId',
  skill: 'skillId',
  app: 'appId',
  candidate: 'candidateId',
}
