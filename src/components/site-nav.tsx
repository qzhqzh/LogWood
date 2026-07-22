import Link from 'next/link'
import { SITE_NAME } from '@/shared/seo'

type NavSection = 'home' | 'skills' | 'gallery' | 'forge' | 'candidates' | 'articles' | 'coding' | 'app'
type NavLinkSection = 'skills' | 'gallery' | 'forge' | 'candidates'

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

function normalizeActive(active: NavSection): 'home' | NavLinkSection | 'articles' {
  if (active === 'app') return 'gallery'
  if (active === 'articles') return 'articles'
  if (active === 'skills' || active === 'gallery' || active === 'forge' || active === 'candidates') {
    return active
  }
  return 'home'
}

function navBarTintClass(): string {
  return 'border-divider'
}

function navLinkClass(section: NavLinkSection, active: ReturnType<typeof normalizeActive>): string {
  const base = 'transition-colors font-semibold tracking-wide'
  if (active === 'home') {
    if (section === 'skills') return `${base} text-coding hover-text-coding`
    if (section === 'gallery') return `${base} text-app hover-text-app`
    if (section === 'candidates') return `${base} text-amber-300 hover:text-amber-200`
    return `${base} text-article hover-text-article`
  }

  if (section === active) {
    if (section === 'skills') return `${base} text-coding`
    if (section === 'gallery') return `${base} text-app`
    if (section === 'candidates') return `${base} text-amber-300`
    return `${base} text-article`
  }

  if (section === 'skills') return `${base} text-muted hover-text-coding`
  if (section === 'gallery') return `${base} text-muted hover-text-app`
  if (section === 'candidates') return `${base} text-muted hover:text-amber-200`
  return `${base} text-muted hover-text-article`
}

function defaultNavItems(active: ReturnType<typeof normalizeActive>): SiteNavItem[] {
  return [
    {
      href: '/skills',
      label: 'Skill 室',
      className: navLinkClass('skills', active),
    },
    {
      href: '/candidates',
      label: '候选评测',
      className: navLinkClass('candidates', active),
    },
    {
      href: '/app',
      label: '画廊',
      className: navLinkClass('gallery', active),
    },
    {
      href: '/forge',
      label: '造物台',
      className: navLinkClass('forge', active),
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
  const normalized = normalizeActive(active)
  const items = navItems ?? defaultNavItems(normalized)

  return (
    <nav className={`border-b ${borderClassName ?? navBarTintClass()} bg-[color:var(--color-nav-bg)] backdrop-blur-xl sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-[var(--color-accent-coding)] to-[var(--color-accent-app)] rounded-lg flex items-center justify-center">
              <span className="text-[var(--color-bg)] font-bold text-sm">空</span>
            </div>
            <span className="text-xl sm:text-2xl font-bold font-['Orbitron'] gradient-text truncate">
              {SITE_NAME}
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
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
