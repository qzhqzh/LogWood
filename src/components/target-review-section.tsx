import { EvaluationPanel } from '@/components/evaluation-panel'
import { ReviewPanel } from '@/components/review-panel'
import { LifecycleOriginHistory } from '@/components/lifecycle-origin-history'

interface TargetReviewSectionProps {
  targetId: string
  canPublishReview: boolean
}

export function TargetReviewSection({ targetId, canPublishReview }: TargetReviewSectionProps) {
  return (
    <>
      <LifecycleOriginHistory subjectType="target" subjectId={targetId} />
      <EvaluationPanel subjectType="target" subjectId={targetId} />
      <ReviewPanel
        subjectType="target"
        subjectId={targetId}
        canPublishReview={canPublishReview}
        title="自由记录、提问或吐槽"
      />
    </>
  )
}
