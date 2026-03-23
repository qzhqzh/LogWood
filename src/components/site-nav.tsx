import Link from 'next/link'

type NavSection = 'home' | 'coding' | 'app' | 'articles'
type NavLinkSection = Exclude<NavSection, 'home'>

interface SiteNavItem {
  href: string
  label: string
  className: string
}

interface SiteNavProps {
  active?: NavSection
  actionLabel?: string
  actionHref?: string
  navItems?: SiteNavItem[]
  borderClassName?: string
}

function navBarTintClass(active: NavSection): string {
  if (active === 'home') return 'border-cyan-500/20'
  if (active === 'coding') return 'border-cyan-500/30'
  if (active === 'app') return 'border-purple-500/30'
  return 'border-pink-500/30'
}

function navLinkClass(section: NavLinkSection, active: NavSection): string {
  const base = 'transition-colors font-semibold tracking-wide'
  if (active === 'home') {
    if (section === 'coding') return `${base} text-cyan-400 hover:text-cyan-300`
    if (section === 'app') return `${base} text-purple-400 hover:text-purple-300`
    if (section === 'articles') return `${base} text-pink-400 hover:text-pink-300`
    return `${base} text-white`
  }

  if (section === active) {
    if (section === 'coding') return `${base} text-cyan-300`
    if (section === 'app') return `${base} text-purple-300`
    return `${base} text-pink-300`
  }

  if (section === 'coding') return `${base} text-cyan-500 hover:text-cyan-300`
  if (section === 'app') return `${base} text-purple-500 hover:text-purple-300`
  return `${base} text-pink-500 hover:text-pink-300`
}

function defaultNavItems(active: NavSection): SiteNavItem[] {
  return [
    {
      href: '/coding',
      label: 'AI Coding',
      className: navLinkClass('coding', active),
    },
    {
      href: '/app',
      label: '应用工坊',
      className: navLinkClass('app', active),
    },
    {
      href: '/articles',
      label: '社区文章',
      className: navLinkClass('articles', active),
    },
  ]
}

export function SiteNav({
  active = 'home',
  actionLabel,
  actionHref,
  navItems,
  borderClassName,
}: SiteNavProps) {
  const items = navItems ?? defaultNavItems(active)

  return (
    <nav className={`border-b ${borderClassName ?? navBarTintClass(active)} bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">LW</span>
            </div>
            <span className="text-2xl font-bold font-['Orbitron'] gradient-text">LogWood</span>
          </Link>

          <div className="flex items-center gap-6">
            {items.map((item) => (
              <Link key={`${item.href}:${item.label}`} href={item.href} className={item.className}>
                {item.label}
              </Link>
            ))}
            {actionLabel && actionHref && (
              <Link
                href={actionHref}
                className="cyber-button w-[112px] text-center px-5 py-2 rounded-lg font-semibold tracking-wide"
              >
                {actionLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
