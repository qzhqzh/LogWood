import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { SITE_NAME } from '@/shared/seo'

export const metadata: Metadata = {
  title: '页面未找到',
  description: '抱歉，访问的页面不存在或已下线。',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--color-accent-1) 12%, transparent)' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--color-accent-2) 12%, transparent)' }} />
      </div>

      <SiteNav />

      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="cyber-card rounded-3xl p-10 sm:p-14 text-center">
          <div className="inline-block mb-6 px-4 py-1 border border-divider rounded-full surface-panel">
            <span className="text-soft text-xs tracking-[0.32em] uppercase">404 / NOT FOUND</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold font-['Orbitron'] gradient-text mb-6 leading-tight">
            页面未找到
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            你访问的页面可能已经下线、链接拼写有误，或者还没创建。
            可以从下面的入口继续在{SITE_NAME}里逛。
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="cyber-button px-6 py-2.5 rounded-lg font-semibold tracking-wide"
            >
              回到首页
            </Link>
            <Link
              href="/skills"
              className="px-6 py-2.5 rounded-lg font-semibold tracking-wide border border-divider text-coding hover-text-coding surface-panel transition-colors"
            >
              Skill 室
            </Link>
            <Link
              href="/app"
              className="px-6 py-2.5 rounded-lg font-semibold tracking-wide border border-divider text-app hover-text-app surface-panel transition-colors"
            >
              画廊
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
