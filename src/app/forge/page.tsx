import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { MessageSquare } from 'lucide-react'
import { AiRuntimeStatus } from '@/components/ai-runtime-status'
import { ForgeDraftForm } from '@/components/forge-draft-form'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { ThoughtWorkbench } from '@/components/thought-workbench'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { getAiCapabilities } from '@/modules/ai-runtime'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const metadata: Metadata = buildMetadata({
  title: '思想工作台',
  description: '和 AI 把一个念头讨论清楚，自动保存完整讨论，整理为文章草稿，并由作者确认当前版本后发表。',
  path: '/forge',
})

export default async function ForgePage({
  searchParams,
}: {
  searchParams?: { session?: string }
}) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const runtime = getAiCapabilities().find((item) => item.id === 'forge-draft')!

  return (
    <main className="ascii-app">
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: '思想工作台', path: '/forge' },
      ])} />
      <SiteNav
        active="forge"
        actionLabel={isAdmin ? '文章管理' : undefined}
        actionHref={isAdmin ? '/articles/manage' : undefined}
      />

      <header className="ascii-page-header ascii-compare-header">
        <div>
          <p className="ascii-kicker">[:: DISCUSS / DISTILL / PUBLISH ::]</p>
          <h1>思想工作台</h1>
          <p>你负责说和判断，AI 负责追问、记录与成稿。讨论自动保存在私有空间，只有你确认的文章版本才会公开。</p>
        </div>
        <MessageSquare className="ascii-page-header__icon" aria-hidden />
      </header>

      <ThoughtWorkbench
        isAdmin={isAdmin}
        initialSessionId={searchParams?.session}
        runtime={{
          configured: runtime.configured,
          provider: runtime.provider,
          model: runtime.model,
        }}
      />

      <section className="ascii-forge-shell ascii-forge-shell--secondary">
        <details className="ascii-forge-advanced">
          <summary>
            <span>已经有完整素材？</span>
            <strong>打开结构化整理工具</strong>
          </summary>
          <div className="ascii-forge-advanced__body">
            {isAdmin ? <AiRuntimeStatus /> : null}
            <ForgeDraftForm />
          </div>
        </details>

        <nav className="ascii-forge-links" aria-label="相关作者工具">
          <Link href="/candidates" className="ascii-button">打开收集箱</Link>
          <Link href="/skills" className="ascii-button">查看提示库</Link>
          <Link href="/articles" className="ascii-button">查看已发表文章</Link>
        </nav>
      </section>

      <SiteFooter />
    </main>
  )
}
