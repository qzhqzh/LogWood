import Link from 'next/link'
import { FooterAdminLinks } from '@/components/footer-admin-links'
import { FooterAuthEntry } from '@/components/footer-auth-entry'

const sections = [
  {
    title: 'AI Coding',
    href: '/coding',
    colorClass: 'hover:text-cyan-400',
  },
  {
    title: '应用工坊',
    href: '/app',
    colorClass: 'hover:text-purple-400',
  },
  {
    title: '社区文章',
    href: '/articles',
    colorClass: 'hover:text-pink-400',
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-cyan-500/10 py-12 px-4 mt-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">LW</span>
            </div>
            <span className="text-xl font-bold font-['Orbitron'] gradient-text">LogWood</span>
          </div>

          <div className="text-center md:text-left">
            <p className="text-gray-500 text-sm">© 2026 LogWood. AI 编码工具评测社区</p>
            <p className="text-gray-500 text-xs mt-1">鄂ICP备2026011298号-1</p>
            <a
              href="https://github.com/qzhqzh/LogWood"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-300 transition-colors mt-2"
              aria-label="查看 LogWood GitHub 仓库"
            >
              GitHub 仓库
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="grid grid-cols-3 gap-8 text-sm min-w-[280px]">
            {sections.map((item) => (
              <div key={item.title} className="text-center md:text-left">
                <Link href={item.href} className={`text-gray-400 transition-colors ${item.colorClass}`}>
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
