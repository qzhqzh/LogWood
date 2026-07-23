import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { EvaluationProtocol } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { EvaluationCard } from '@/components/evaluation-card'
import {
  EVALUATION_PROTOCOLS,
  listEvaluations,
} from '@/modules/evaluation'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: '正式评测',
  description: '基于版本、环境、任务、证据、维度评分和失败边界的 Evaluation v2 正式评测。',
  path: '/evaluations',
})

interface EvaluationsPageProps {
  searchParams: Promise<{ protocol?: string; page?: string }>
}

export default async function EvaluationsPage({ searchParams }: EvaluationsPageProps) {
  const params = await searchParams
  const protocol = Object.values(EvaluationProtocol).includes(params.protocol as EvaluationProtocol)
    ? params.protocol as EvaluationProtocol
    : undefined
  const page = Math.max(Number.parseInt(params.page || '1', 10) || 1, 1)
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { evaluations, total } = await listEvaluations({ protocol, page, pageSize: 18 })

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '正式评测', path: '/evaluations' },
        ])}
      />
      <SiteNav active="inspiration" />

      <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <p className="text-xs tracking-[0.28em] text-emerald-300 uppercase mb-3">EVALUATION V2 · EVIDENCE FIRST</p>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">正式评测</h1>
            <p className="text-lg text-muted max-w-3xl leading-relaxed">
              自由记录用于保留真实感受；正式评测则必须说明版本、环境、任务、证据、复现情况、维度评分、限制和结论。
            </p>
          </div>
          {isAdmin && (
            <Link href="/evaluations/manage" className="cyber-button px-5 py-2 rounded-lg font-semibold">
              管理正式评测
            </Link>
          )}
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-8">
          {Object.values(EVALUATION_PROTOCOLS).map((definition) => (
            <Link
              key={definition.key}
              href={`/evaluations?protocol=${definition.key}`}
              className={`cyber-card rounded-xl p-4 transition-colors ${
                protocol === definition.key ? 'border-emerald-400/60' : 'hover:border-emerald-500/30'
              }`}
            >
              <h2 className="font-semibold text-[var(--color-text-strong)]">{definition.label}</h2>
              <p className="text-xs text-soft mt-2 line-clamp-3">{definition.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3 text-sm">
          <Link
            href="/evaluations"
            className={`px-3 py-1.5 rounded-full border ${!protocol ? 'status-info' : 'border-divider text-muted'}`}
          >
            全部 · {total}
          </Link>
          <Link href="/talk" className="text-soft hover:text-purple-200 ml-auto">
            查看自由记录 / 吐槽室 →
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {evaluations.length === 0 ? (
          <div className="cyber-card rounded-2xl p-12 text-center">
            <p className="text-xl text-[var(--color-text-strong)] mb-2">还没有正式评测</p>
            <p className="text-muted">先保留真实使用记录，再按协议补齐证据和结论。</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            {evaluations.map((evaluation) => (
              <EvaluationCard key={evaluation.id} evaluation={evaluation} />
            ))}
          </div>
        )}

        {total > page * 18 && (
          <div className="mt-8 text-center">
            <Link
              href={`/evaluations?page=${page + 1}${protocol ? `&protocol=${protocol}` : ''}`}
              className="cyber-button px-6 py-2 rounded-lg inline-block"
            >
              下一页
            </Link>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
