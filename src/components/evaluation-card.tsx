import Link from 'next/link'
import {
  EvaluationProtocol,
  EvaluationReproducibility,
  EvaluationVerdict,
  type Prisma,
} from '@prisma/client'
import {
  EVALUATION_PROTOCOLS,
  EVALUATION_REPRODUCIBILITY_LABELS,
  EVALUATION_VERDICT_LABELS,
  averageEvaluationScore,
  evaluationScores,
} from '@/modules/evaluation'
import { getReviewSubjectPresentation } from '@/shared/reviews/subject'

interface EvaluationCardProps {
  evaluation: {
    id: string
    title: string
    protocol: EvaluationProtocol
    verdict: EvaluationVerdict
    reproducibility: EvaluationReproducibility
    subjectVersion: string | null
    task: string
    conclusion: string
    scores: Prisma.JsonValue | null
    testedAt: Date
    target?: { name: string; slug: string; type: string } | null
    skill?: { title: string; slug: string } | null
    app?: { title: string; slug: string } | null
    candidate?: { title: string; slug: string } | null
  }
  compact?: boolean
}

export function EvaluationCard({ evaluation, compact = false }: EvaluationCardProps) {
  const subject = getReviewSubjectPresentation(evaluation)
  const score = averageEvaluationScore(evaluationScores(evaluation.scores))

  return (
    <article className="cyber-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-300">
              {EVALUATION_PROTOCOLS[evaluation.protocol].label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300">
              {EVALUATION_VERDICT_LABELS[evaluation.verdict]}
            </span>
          </div>
          <Link
            href={`/evaluations/${evaluation.id}`}
            className="text-xl font-semibold text-[var(--color-text-strong)] hover:text-cyan-200"
          >
            {evaluation.title}
          </Link>
          {subject && (
            <p className="text-sm text-soft mt-1">
              评测对象：
              <Link href={subject.href} className="text-coding hover:text-cyan-200">
                {subject.title}
              </Link>
              {evaluation.subjectVersion ? ` · ${evaluation.subjectVersion}` : ''}
            </p>
          )}
        </div>
        {score != null && (
          <div className="text-right">
            <div className="text-3xl font-bold font-['Orbitron'] text-yellow-400">{score}</div>
            <div className="text-xs text-soft">综合 / 10</div>
          </div>
        )}
      </div>

      <p className={`text-muted leading-relaxed ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
        {evaluation.task}
      </p>

      {!compact && (
        <p className="mt-3 text-sm text-soft line-clamp-3">
          结论：{evaluation.conclusion}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-divider flex flex-wrap items-center gap-3 text-xs text-soft">
        <span>{EVALUATION_REPRODUCIBILITY_LABELS[evaluation.reproducibility]}</span>
        <span>{new Date(evaluation.testedAt).toLocaleDateString('zh-CN')}</span>
        <Link href={`/evaluations/${evaluation.id}`} className="ml-auto text-cyan-300 hover:text-cyan-200">
          查看正式评测 →
        </Link>
      </div>
    </article>
  )
}
