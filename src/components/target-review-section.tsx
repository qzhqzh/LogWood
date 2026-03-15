'use client'

import { useState } from 'react'
import { ReviewList } from '@/components/review-list'
import { InlineReviewComposer } from '@/components/inline-review-composer'

interface TargetReviewSectionProps {
  targetId: string
  canPublishReview: boolean
}

export function TargetReviewSection({ targetId, canPublishReview }: TargetReviewSectionProps) {
  const [refreshToken, setRefreshToken] = useState(0)

  return (
    <div>
      {canPublishReview && (
        <InlineReviewComposer
          targetId={targetId}
          onSubmitted={() => setRefreshToken((prev) => prev + 1)}
        />
      )}
      <ReviewList key={`${targetId}-${refreshToken}`} targetId={targetId} />
    </div>
  )
}
