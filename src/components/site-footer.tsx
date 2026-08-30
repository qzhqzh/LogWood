import Link from 'next/link'
import { FooterAdminLinks } from '@/components/footer-admin-links'
import { FooterAuthEntry } from '@/components/footer-auth-entry'
import { SITE_NAME, SITE_TAGLINE } from '@/shared/seo'

const publicLinks = [
  { label: 'Prompt', href: '/workbench' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Awesome', href: '/awesome' },
  { label: '验证记录', href: '/evaluations' },
  { label: '笔记', href: '/articles' },
  { label: '关于秦', href: '/about' },
] as const

const workbenchLinks = [
  { label: '收集箱', href: '/candidates' },
  { label: 'AI 整理', href: '/forge' },
  { label: '归档', href: '/scraps' },
  { label: '历史资源', href: '/tools' },
] as const

export function SiteFooter() {
  return (
    <footer className="ascii-footer">
      <div className="ascii-signal-rule" aria-hidden="true">::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::</div>
      <div className="ascii-footer__grid">
        <div>
          <p className="ascii-footer__brand">[ {SITE_NAME} ]</p>
          <p className="ascii-footer__tagline">{SITE_TAGLINE}</p>
          <p className="ascii-footer__copyright">© 2026 {SITE_NAME} · 鄂ICP备2026011298号-1</p>
        </div>

        <nav aria-label="公开内容" className="ascii-footer__links">
          <p>[:: 公开内容 ::]</p>
          {publicLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>

        <nav aria-label="作者工作台" className="ascii-footer__links">
          <p>[:: 作者工作台 ::]</p>
          {workbenchLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>

        <div className="ascii-footer__account">
          <p>[:: 连接 ::]</p>
          <a href="https://github.com/qzhqzh/LogWood" target="_blank" rel="noopener noreferrer">GitHub 仓库 ↗</a>
          <FooterAdminLinks />
          <FooterAuthEntry />
        </div>
      </div>
    </footer>
  )
}
