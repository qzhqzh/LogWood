import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { EvaluationProtocol } from '@prisma/client'
import { FileCheck2 } from 'lucide-react'
import { EvaluationCard } from '@/components/evaluation-card'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { EVALUATION_PROTOCOLS, listEvaluations } from '@/modules/evaluation'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: '验证记录',
  description: '按明确协议保存版本、环境、任务、证据、复现情况、限制与结论。',
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
  const [session, result] = await Promise.all([
    getServerSession(authOptions),
    listEvaluations({ protocol, page, pageSize: 18 }),
  ])
  const isAdmin = isAdminSession(session)

  return (
    <main className="ascii-app">
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: '验证记录', path: '/evaluations' },
      ])} />
      <SiteNav
        active="evaluations"
        actionLabel={isAdmin ? 'Manage Evidence' : undefined}
        actionHref={isAdmin ? '/evaluations/manage' : undefined}
      />

      <header className="ascii-page-header ascii-record-header">
        <div>
          <p className="ascii-kicker">[:: EVIDENCE / EVALUATION V2 ::]</p>
          <h1>验证记录</h1>
          <p>不靠印象宣布有效。每份公开记录都应说明版本、环境、任务、证据、复现情况、限制与结论。</p>
        </div>
        <dl className="ascii-page-stats">
          <div><dt>当前公开</dt><dd>{result.total}</dd></div>
          <div><dt>协议版本</dt><dd>2</dd></div>
          <div><dt>当前页</dt><dd>{page}</dd></div>
        </dl>
      </header>

      <section className="ascii-protocol-strip" aria-label="评测协议筛选">
        <Link href="/evaluations" className={!protocol ? 'is-active' : ''}>
          <span>00</span><strong>全部协议</strong><small>查看所有已公开验证</small>
        </Link>
        {Object.values(EVALUATION_PROTOCOLS).map((definition, index) => (
          <Link
            key={definition.key}
            href={`/evaluations?protocol=${definition.key}`}
            className={protocol === definition.key ? 'is-active' : ''}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{definition.label}</strong>
            <small>{definition.description}</small>
          </Link>
        ))}
      </section>

      <div className="ascii-record-toolbar">
        <p>{protocol ? `当前协议：${EVALUATION_PROTOCOLS[protocol].label}` : '当前显示：全部公开验证'}</p>
        <Link href="/talk">查看历史自由反馈</Link>
      </div>

      <section className="ascii-record-grid" aria-label="已公开验证记录">
        {result.evaluations.map((evaluation) => (
          <EvaluationCard key={evaluation.id} evaluation={evaluation} />
        ))}
        {result.evaluations.length === 0 ? (
          <div className="ascii-panel ascii-empty-state">
            <FileCheck2 className="h-8 w-8" aria-hidden />
            <h2>还没有符合条件的公开验证</h2>
            <p>先保留真实使用结果，再按协议补齐证据和结论。</p>
          </div>
        ) : null}
      </section>

      {result.total > page * 18 ? (
        <nav className="ascii-pagination" aria-label="验证记录分页">
          <Link href={`/evaluations?page=${page + 1}${protocol ? `&protocol=${protocol}` : ''}`} className="ascii-button">下一页</Link>
        </nav>
      ) : null}

      <SiteFooter />
    </main>
  )
}
