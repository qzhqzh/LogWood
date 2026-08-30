import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Bot, FileInput, ShieldCheck } from 'lucide-react'
import { AiRuntimeStatus } from '@/components/ai-runtime-status'
import { ForgeDraftForm } from '@/components/forge-draft-form'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const metadata: Metadata = buildMetadata({
  title: 'AI 整理台',
  description: '用可发现、幂等且带完整归属的 AI 协作或本地模板，把灵感整理成提示词或笔记草稿；公开仍需人工门禁。',
  path: '/forge',
})

export default async function ForgePage() {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)

  return (
    <main className="ascii-app">
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: 'AI 整理台', path: '/forge' },
      ])} />
      <SiteNav active="forge" />

      <header className="ascii-page-header ascii-compare-header">
        <div>
          <p className="ascii-kicker">[:: HUMAN + AI / DRAFT ONLY ::]</p>
          <h1>AI 整理台</h1>
          <p>把原始材料整理成提示词或笔记草稿。请求可安全重试，模型归属会被保存，AI 结果不会越过人工发布门禁。</p>
        </div>
        <Bot className="ascii-page-header__icon" aria-hidden />
      </header>

      <section className="ascii-forge-shell">
        <ol className="ascii-forge-flow" aria-label="AI 协作流程">
          <li><FileInput className="h-5 w-5" aria-hidden /><span><strong>输入原始材料</strong><small>可关联收集箱中的来源</small></span></li>
          <li><Bot className="h-5 w-5" aria-hidden /><span><strong>AI 或本地模板整理</strong><small>幂等调用，失败时保留输入</small></span></li>
          <li><ShieldCheck className="h-5 w-5" aria-hidden /><span><strong>人工检查后发布</strong><small>草稿默认不公开</small></span></li>
        </ol>

        {isAdmin ? <AiRuntimeStatus /> : null}
        <ForgeDraftForm />

        <nav className="ascii-forge-links" aria-label="相关作者工具">
          <Link href="/candidates" className="ascii-button">打开收集箱</Link>
          <Link href="/skills" className="ascii-button">查看提示库</Link>
          <Link href="/articles" className="ascii-button">查看笔记</Link>
        </nav>
      </section>

      <SiteFooter />
    </main>
  )
}
