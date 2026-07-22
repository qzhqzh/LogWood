import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { ForgeDraftForm } from '@/components/forge-draft-form'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const metadata: Metadata = buildMetadata({
  title: 'AI 炼成助手（Beta）',
  description: '用确定性的本地模板把一句灵感整理为 Skill 或洞笔记草稿。当前尚未接入真实模型，不替代试用、评测与人工验证。',
  path: '/forge',
})

export default function ForgePage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: 'AI 炼成助手', path: '/forge' },
        ])}
      />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav active="forge" />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative text-center">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-1 border border-pink-500/30 rounded-full bg-pink-500/5">
          <span className="text-pink-300 text-sm tracking-widest uppercase">LOCAL TEMPLATE</span>
          <span className="text-xs px-2 py-0.5 rounded bg-pink-500/15 text-pink-200">BETA</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] mb-4 gradient-text">AI 炼成助手</h1>
        <p className="text-xl text-[var(--color-text-strong)] mb-4">先把零散输入整理成可以继续工作的草稿</p>
        <p className="text-muted text-lg leading-relaxed mb-6">
          把一句灵感、一次踩坑或一段可复用指令整理成洞笔记草稿或独立 Skill 草稿，再由人工补充来源、证据、边界与验证记录。
        </p>
        <div className="cyber-card rounded-xl p-4 mb-10 text-left text-sm text-soft">
          <strong className="text-[var(--color-text-strong)]">能力说明：</strong>
          当前版本只执行确定性的本地模板整理，不调用外部模型，不自动评测，也不会把未经验证的内容包装成事实。
        </div>

        <ForgeDraftForm />

        <div className="flex flex-wrap justify-center gap-4 mt-10">
          <Link href="/candidates" className="px-6 py-3 rounded-lg font-semibold border border-amber-500/30 text-amber-300 hover:border-amber-400/60 transition-colors">
            找灵感
          </Link>
          <Link
            href="/skills"
            className="px-6 py-3 rounded-lg font-semibold border border-cyan-500/30 text-cyan-300 hover:border-cyan-400/60 transition-colors"
          >
            Skill 库
          </Link>
          <Link
            href="/articles"
            className="px-6 py-3 rounded-lg font-semibold border border-pink-500/30 text-pink-300 hover:border-pink-400/60 transition-colors"
          >
            洞笔记
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
