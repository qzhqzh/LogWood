import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import {
  EVALUATION_PROTOCOLS,
  EVALUATION_REPRODUCIBILITY_LABELS,
  EVALUATION_VERDICT_LABELS,
  averageEvaluationScore,
  evaluationEnvironment,
  evaluationEvidence,
  evaluationScoreRows,
  evaluationScores,
  getEvaluationById,
} from '@/modules/evaluation'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { getReviewSubjectPresentation } from '@/shared/reviews/subject'

export const revalidate = 60

interface EvaluationDetailProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EvaluationDetailProps): Promise<Metadata> {
  const { id } = await params
  const evaluation = await getEvaluationById(id)
  if (!evaluation) return { title: 'Not Found' }
  return buildMetadata({
    title: evaluation.title,
    description: evaluation.conclusion.slice(0, 160),
    path: `/evaluations/${evaluation.id}`,
  })
}

function TextSection({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null
  return (
    <section className="cyber-card rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-strong)] mb-3">{title}</h2>
      <p className="text-muted whitespace-pre-wrap break-words leading-relaxed">{value}</p>
    </section>
  )
}

export default async function EvaluationDetailPage({ params }: EvaluationDetailProps) {
  const { id } = await params
  const evaluation = await getEvaluationById(id)
  if (!evaluation) notFound()

  const subject = getReviewSubjectPresentation(evaluation)
  const protocol = EVALUATION_PROTOCOLS[evaluation.protocol]
  const scores = evaluationScores(evaluation.scores)
  const scoreRows = evaluationScoreRows(evaluation.protocol, scores)
  const average = averageEvaluationScore(scores)
  const environment = evaluationEnvironment(evaluation.environment)
  const evidence = evaluationEvidence(evaluation.evidence)
  const environmentRows = [
    ['模型', environment.model],
    ['模型版本', environment.modelVersion],
    ['软件 / 工具', environment.software],
    ['软件版本', environment.softwareVersion],
    ['操作系统', environment.operatingSystem],
    ['硬件', environment.hardware],
    ['环境备注', environment.notes],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  const breadcrumbItems = [
    { name: '首页', path: '/' },
    { name: '正式评测', path: '/evaluations' },
    { name: evaluation.title, path: `/evaluations/${evaluation.id}` },
  ]

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd value={buildBreadcrumbList(breadcrumbItems)} />
      <SiteNav active="inspiration" />

      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/evaluations" className="text-sm text-emerald-300 hover:text-emerald-200">
          ← 回正式评测
        </Link>

        <header className="mt-6 cyber-card rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-300">
                  {protocol.label} · v{evaluation.protocolVersion}
                </span>
                <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300">
                  {EVALUATION_VERDICT_LABELS[evaluation.verdict]}
                </span>
                <span className="text-xs px-2 py-0.5 rounded border border-divider text-soft">
                  {EVALUATION_REPRODUCIBILITY_LABELS[evaluation.reproducibility]}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">
                {evaluation.title}
              </h1>
              {subject && (
                <p className="text-muted">
                  评测对象：
                  <Link href={subject.href} className="text-coding hover:text-cyan-200">
                    {subject.title}
                  </Link>
                  {evaluation.subjectVersion ? ` · 版本 ${evaluation.subjectVersion}` : ''}
                </p>
              )}
              <p className="text-sm text-soft mt-3">
                测试日期：{new Date(evaluation.testedAt).toLocaleDateString('zh-CN')} · 重复次数：{evaluation.repeatCount}
                {evaluation.author?.name ? ` · 作者：${evaluation.author.name}` : ''}
              </p>
            </div>
            {average != null && (
              <div className="text-center min-w-28">
                <div className="text-5xl font-bold font-['Orbitron'] text-yellow-400">{average}</div>
                <div className="text-sm text-soft mt-1">综合 / 10</div>
              </div>
            )}
          </div>
        </header>

        <div className="mt-8 grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
          <div className="space-y-6">
            <TextSection title="测试任务" value={evaluation.task} />
            <TextSection title="输入与前置条件" value={evaluation.input} />
            <TextSection title="执行过程" value={evaluation.procedure} />
            <TextSection title="输出与结果" value={evaluation.output} />
            <TextSection title="成功点" value={evaluation.strengths} />
            <TextSection title="失败、限制与边界" value={evaluation.limitations} />
            <section className="cyber-card rounded-2xl p-6 border-emerald-500/20">
              <h2 className="text-lg font-semibold text-emerald-300 mb-3">总体结论</h2>
              <p className="text-[var(--color-text-strong)] whitespace-pre-wrap break-words leading-relaxed">
                {evaluation.conclusion}
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="cyber-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-strong)] mb-4">维度评分</h2>
              <div className="space-y-4">
                {scoreRows.map((row) => (
                  <div key={row.key}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-sm text-muted">{row.label}</span>
                      <span className="font-semibold text-yellow-400">{row.score ?? '—'}</span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                        style={{ width: `${Math.max(0, Math.min(10, row.score ?? 0)) * 10}%` }}
                      />
                    </div>
                    <p className="text-xs text-soft mt-1">{row.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {environmentRows.length > 0 && (
              <section className="cyber-card rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-[var(--color-text-strong)] mb-4">测试环境</h2>
                <dl className="space-y-3">
                  {environmentRows.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-soft">{label}</dt>
                      <dd className="text-sm text-muted mt-1 whitespace-pre-wrap">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="cyber-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-strong)] mb-4">证据</h2>
              {evidence.length === 0 ? (
                <p className="text-sm text-soft">本评测以正文输出作为证据，未附外部链接。</p>
              ) : (
                <div className="space-y-3">
                  {evidence.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="border-b border-divider pb-3 last:border-0 last:pb-0">
                      <p className="text-sm text-muted">{item.label}</p>
                      <p className="text-xs text-soft mt-1">{item.type}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-sm text-cyan-300 hover:text-cyan-200 break-all"
                        >
                          打开证据 ↗
                        </a>
                      )}
                      {item.note && <p className="text-xs text-soft mt-1 whitespace-pre-wrap">{item.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </article>

      <SiteFooter />
    </main>
  )
}
