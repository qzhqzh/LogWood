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
  if (active === 'home') return 'border-divider'
  if (active === 'coding') return 'border-divider'
  if (active === 'app') return 'border-divider'
  return 'border-divider'
}

function navLinkClass(section: NavLinkSection, active: NavSection): string {
  const base = 'transition-colors font-semibold tracking-wide'
  if (active === 'home') {
    if (section === 'coding') return `${base} text-coding hover-text-coding`
    if (section === 'app') return `${base} text-app hover-text-app`
    if (section === 'articles') return `${base} text-article hover-text-article`
    return `${base} text-[var(--color-text-strong)]`
  }

  if (section === active) {
    if (section === 'coding') return `${base} text-coding`
    if (section === 'app') return `${base} text-app`
    return `${base} text-article`
  }

  if (section === 'coding') return `${base} text-muted hover-text-coding`
  if (section === 'app') return `${base} text-muted hover-text-app`
  return `${base} text-muted hover-text-article`
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
    <nav className={`border-b ${borderClassName ?? navBarTintClass(active)} bg-[color:var(--color-nav-bg)] backdrop-blur-xl sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-accent-coding)] to-[var(--color-accent-app)] rounded-lg flex items-center justify-center">
              <span className="text-[var(--color-bg)] font-bold text-sm">LW</span>
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
