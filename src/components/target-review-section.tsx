'use client'

import { ReviewPanel } from '@/components/review-panel'

interface TargetReviewSectionProps {
  targetId: string
  canPublishReview: boolean
}

export function TargetReviewSection({ targetId, canPublishReview }: TargetReviewSectionProps) {
  return (
    <ReviewPanel
      subjectType="target"
      subjectId={targetId}
      canPublishReview={canPublishReview}
    />
  )
}
