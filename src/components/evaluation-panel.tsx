import Link from 'next/link'
import type { EvaluationSubjectType } from '@/modules/evaluation'
import { listPublishedEvaluationsForSubject } from '@/modules/evaluation'
import { EvaluationCard } from '@/components/evaluation-card'

interface EvaluationPanelProps {
  subjectType: EvaluationSubjectType
  subjectId: string
  title?: string
}

export async function EvaluationPanel({
  subjectType,
  subjectId,
  title = '正式评测',
}: EvaluationPanelProps) {
  const evaluations = await listPublishedEvaluationsForSubject(subjectType, subjectId, 4)

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-emerald-300 uppercase mb-1">EVALUATION V2</p>
          <h2 className="text-2xl font-bold font-['Orbitron'] gradient-text">{title}</h2>
        </div>
        <Link href="/evaluations" className="text-sm text-cyan-300 hover:text-cyan-200 whitespace-nowrap">
          评测协议与全部报告 →
        </Link>
      </div>

      {evaluations.length === 0 ? (
        <div className="cyber-card rounded-2xl p-6 text-muted">
          暂无符合 Evaluation v2 协议的正式评测。下方自由记录仍可用于吐槽、提问和积累待验证问题。
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {evaluations.map((evaluation) => (
            <EvaluationCard key={evaluation.id} evaluation={evaluation} compact />
          ))}
        </div>
      )}
    </section>
  )
}
