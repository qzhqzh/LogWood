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
    <main className="ascii-app">
      <SiteNav />

      <section className="ascii-page-header ascii-not-found">
        <div>
          <p className="ascii-kicker">[:: 404 / NOT FOUND ::]</p>
          <h1>页面未找到</h1>
          <p>
            你访问的页面可能已经下线、链接拼写有误，或者还没创建。
            可以从下面的入口继续在 {SITE_NAME} 检查真实提示词和记录。
          </p>
        </div>

        <nav className="ascii-not-found__actions" aria-label="继续浏览">
          <Link href="/" className="ascii-button ascii-button--solid">回到首页</Link>
          <Link href="/skills" className="ascii-button">打开提示库</Link>
          <Link href="/articles" className="ascii-button">查看笔记</Link>
        </nav>
      </section>

      <SiteFooter />
    </main>
  )
}
