import Link from 'next/link'
import { History } from 'lucide-react'
import { EvaluationPanel } from '@/components/evaluation-panel'
import { ReviewPanel } from '@/components/review-panel'
import { findPromotionOrigin } from '@/modules/lifecycle'
import type { PromotedSubjectType } from '@/modules/lifecycle'

interface LifecycleOriginHistoryProps {
  subjectType: PromotedSubjectType
  subjectId: string
}

export async function LifecycleOriginHistory({
  subjectType,
  subjectId,
}: LifecycleOriginHistoryProps) {
  const origin = await findPromotionOrigin(subjectType, subjectId)
  if (!origin) return null

  return (
    <>
      <section className="mt-10 rounded-lg border border-divider p-5">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden />
          <div>
            <h2 className="font-semibold text-[var(--color-text-strong)]">入藏来源</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              这份收藏由灵感“
              <Link href={origin.href} className="text-amber-200 hover:text-amber-100">{origin.title}</Link>
              ”整理而来。入藏前的判断仍保存在原记录中。
            </p>
            <p className="mt-2 text-xs text-soft">
              入藏前历史：{origin.reviewCount} 条吐槽或记录，{origin.evaluationCount} 份正式评测
            </p>
          </div>
        </div>
      </section>

      {origin.evaluationCount > 0 ? (
        <EvaluationPanel subjectType="candidate" subjectId={origin.id} title="入藏前的正式评测" />
      ) : null}
      {origin.reviewCount > 0 ? (
        <ReviewPanel
          subjectType="candidate"
          subjectId={origin.id}
          canPublishReview={false}
          title="入藏前的吐槽与记录"
        />
      ) : null}
    </>
  )
}
