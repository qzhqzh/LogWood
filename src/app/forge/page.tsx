import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { ForgeDraftForm } from '@/components/forge-draft-form'
import { SITE_TAGLINE, buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const metadata: Metadata = buildMetadata({
  title: '造物台',
  description: `用 AI 帮你把灵感写成 Skill 卡片、画廊说明或洞笔记。${SITE_TAGLINE}`,
  path: '/forge',
})

export default function ForgePage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '造物台', path: '/forge' },
        ])}
      />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav active="forge" />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative text-center">
        <div className="inline-block mb-4 px-4 py-1 border border-pink-500/30 rounded-full bg-pink-500/5">
          <span className="text-pink-300 text-sm tracking-widest uppercase">FORGE</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] mb-4 gradient-text">造物台</h1>
        <p className="text-xl text-[var(--color-text-strong)] mb-4">{SITE_TAGLINE}</p>
        <p className="text-muted text-lg leading-relaxed mb-10">
          把一句话或一段说明投喂进来，先长成可编辑的洞笔记草稿或 Skill 条目。
          当前为本地模板生成，接口已预留真实模型接入。
        </p>

        <ForgeDraftForm />

        <div className="flex flex-wrap justify-center gap-4 mt-10">
          <Link href="/articles" className="px-6 py-3 rounded-lg font-semibold border border-pink-500/30 text-pink-300 hover:border-pink-400/60 transition-colors">
            洞笔记
          </Link>
          <Link
            href="/skills"
            className="px-6 py-3 rounded-lg font-semibold border border-cyan-500/30 text-cyan-300 hover:border-cyan-400/60 transition-colors"
          >
            Skill 室
          </Link>
          <Link
            href="/app"
            className="px-6 py-3 rounded-lg font-semibold border border-purple-500/30 text-purple-300 hover:border-purple-400/60 transition-colors"
          >
            画廊
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
