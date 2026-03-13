import Link from 'next/link'

type NavSection = 'coding' | 'app' | 'articles'

interface SiteNavProps {
  active: NavSection
  actionLabel: string
  actionHref: string
}

function navBarTintClass(active: NavSection): string {
  if (active === 'coding') return 'border-cyan-500/30'
  if (active === 'app') return 'border-purple-500/30'
  return 'border-blue-500/30'
}

function navLinkClass(section: NavSection, active: NavSection): string {
  const base = 'transition-colors font-semibold tracking-wide'
  if (section === active) {
    if (section === 'coding') return `${base} text-cyan-300`
    if (section === 'app') return `${base} text-purple-300`
    return `${base} text-blue-300`
  }

  if (section === 'coding') return `${base} text-cyan-500 hover:text-cyan-300`
  if (section === 'app') return `${base} text-purple-500 hover:text-purple-300`
  return `${base} text-blue-500 hover:text-blue-300`
}

export function SiteNav({ active, actionLabel, actionHref }: SiteNavProps) {
  return (
    <nav className={`border-b ${navBarTintClass(active)} bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">LW</span>
            </div>
            <span className="text-2xl font-bold font-['Orbitron'] gradient-text">LogWood</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/coding" className={navLinkClass('coding', active)}>
              AI Coding
            </Link>
            <Link href="/app" className={navLinkClass('app', active)}>
              应用工坊
            </Link>
            <Link href="/articles" className={navLinkClass('articles', active)}>
              社区文章
            </Link>
            <Link
              href={actionHref}
              className="cyber-button w-[112px] text-center px-5 py-2 rounded-lg font-semibold tracking-wide"
            >
              {actionLabel}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
