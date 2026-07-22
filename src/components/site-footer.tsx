import Link from 'next/link'
import { FooterAdminLinks } from '@/components/footer-admin-links'
import { FooterAuthEntry } from '@/components/footer-auth-entry'
import { SITE_NAME, SITE_TAGLINE } from '@/shared/seo'

const sections = [
  {
    title: 'Skill 室',
    href: '/skills',
    colorClass: 'hover-text-coding',
  },
  {
    title: '候选评测',
    href: '/candidates',
    colorClass: 'hover:text-amber-200',
  },
  {
    title: '画廊',
    href: '/app',
    colorClass: 'hover-text-app',
  },
  {
    title: '造物台',
    href: '/forge',
    colorClass: 'hover-text-article',
  },
  {
    title: '工具收藏',
    href: '/tools',
    colorClass: 'hover-text-coding',
  },
  {
    title: '洞笔记',
    href: '/articles',
    colorClass: 'hover-text-article',
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-divider py-12 px-4 mt-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">空</span>
              </div>
              <span className="text-xl font-bold font-['Orbitron'] gradient-text">{SITE_NAME}</span>
            </div>
            <p className="text-muted text-sm pl-10">{SITE_TAGLINE}</p>
          </div>

          <div className="text-center md:text-left">
            <p className="text-muted text-sm">© 2026 {SITE_NAME}</p>
            <p className="text-muted text-xs mt-1">鄂ICP备2026011298号-1</p>
            <a
              href="https://github.com/qzhqzh/LogWood"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted hover-text-coding transition-colors mt-2"
              aria-label={`查看 ${SITE_NAME} GitHub 仓库`}
            >
              GitHub 仓库
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm min-w-[280px]">
            {sections.map((item) => (
              <div key={item.title} className="text-center md:text-left">
                <Link href={item.href} className={`text-muted transition-colors ${item.colorClass}`}>
                  {item.title}
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4 text-sm whitespace-nowrap">
              <FooterAdminLinks />
              <FooterAuthEntry />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
