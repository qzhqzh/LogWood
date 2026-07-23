import { EvaluationPanel } from '@/components/evaluation-panel'
import { ReviewPanel } from '@/components/review-panel'

interface TargetReviewSectionProps {
  targetId: string
  canPublishReview: boolean
}

export function TargetReviewSection({ targetId, canPublishReview }: TargetReviewSectionProps) {
  return (
    <>
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
