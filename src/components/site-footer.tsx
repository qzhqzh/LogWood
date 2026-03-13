import Link from 'next/link'

const columns = [
  {
    title: 'AI Coding',
    href: '/coding',
    colorClass: 'hover:text-cyan-400',
    tagHref: '/tags',
  },
  {
    title: '应用工坊',
    href: '/app',
    colorClass: 'hover:text-purple-400',
    tagHref: '/tags',
  },
  {
    title: '社区文章',
    href: '/articles',
    colorClass: 'hover:text-pink-400',
    tagHref: '/tags',
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
            <p className="text-gray-500 text-sm">© 2024 LogWood. AI 编码工具评测社区</p>
            <p className="text-gray-500 text-xs mt-1">鄂ICP备2026011298号-1</p>
          </div>

          <div className="grid grid-cols-3 gap-8 text-sm min-w-[280px]">
            {columns.map((item) => (
              <div key={item.title} className="text-center md:text-left">
                <Link href={item.href} className={`text-gray-400 transition-colors ${item.colorClass}`}>
                  {item.title}
                </Link>
                <div className="mt-2">
                  <Link href={item.tagHref} className="text-xs text-gray-500 hover:text-cyan-300 transition-colors">
                    标签
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
