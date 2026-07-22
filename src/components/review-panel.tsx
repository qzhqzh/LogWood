'use client'

import { useState } from 'react'
import { ReviewList } from '@/components/review-list'
import { InlineReviewComposer } from '@/components/inline-review-composer'
import type { ReviewSubjectType } from '@/modules/review/constants'

interface ReviewPanelProps {
  subjectType: ReviewSubjectType
  subjectId: string
  canPublishReview?: boolean
  title?: string
}

export function ReviewPanel({
  subjectType,
  subjectId,
  canPublishReview = true,
  title = '评测',
}: ReviewPanelProps) {
  const [refreshToken, setRefreshToken] = useState(0)

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold font-['Orbitron'] gradient-text mb-4">{title}</h2>
      {canPublishReview && (
        <InlineReviewComposer
          subjectType={subjectType}
          subjectId={subjectId}
          onSubmitted={() => setRefreshToken((prev) => prev + 1)}
        />
      )}
      <ReviewList
        key={`${subjectType}-${subjectId}-${refreshToken}`}
        subjectType={subjectType}
        subjectId={subjectId}
      />
    </section>
  )
}
