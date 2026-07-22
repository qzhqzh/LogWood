import Link from 'next/link'
import { SITE_NAME } from '@/shared/seo'

type NavSection =
  | 'home'
  | 'inspiration'
  | 'skills'
  | 'talk'
  | 'articles'
  | 'gallery'
  | 'forge'
  | 'candidates'
  | 'coding'
  | 'app'

type NavLinkSection = 'inspiration' | 'skills' | 'talk' | 'articles'
type NormalizedNavSection = 'home' | NavLinkSection

interface SiteNavItem {
  href: string
  label: string
  shortLabel?: string
  className: string
}

interface SiteNavProps {
  active?: NavSection
  actionLabel?: string
  actionHref?: string
  navItems?: SiteNavItem[]
  borderClassName?: string
}

function normalizeActive(active: NavSection): NormalizedNavSection {
  if (active === 'skills' || active === 'talk' || active === 'articles') return active
  if (
    active === 'inspiration' ||
    active === 'candidates' ||
    active === 'coding' ||
    active === 'gallery' ||
    active === 'app'
  ) {
    return 'inspiration'
  }
  return 'home'
}

function navBarTintClass(): string {
  return 'border-divider'
}

function navLinkClass(section: NavLinkSection, active: NormalizedNavSection): string {
  const base = 'text-sm sm:text-base transition-colors font-semibold tracking-wide whitespace-nowrap shrink-0'
  const isActive = section === active

  if (section === 'inspiration') {
    return `${base} ${isActive ? 'text-amber-300' : 'text-muted hover:text-amber-200'}`
  }
  if (section === 'skills') {
    return `${base} ${isActive ? 'text-coding' : 'text-muted hover-text-coding'}`
  }
  if (section === 'talk') {
    return `${base} ${isActive ? 'text-app' : 'text-muted hover-text-app'}`
  }
  return `${base} ${isActive ? 'text-article' : 'text-muted hover-text-article'}`
}

function defaultNavItems(active: NormalizedNavSection): SiteNavItem[] {
  return [
    {
      href: '/candidates',
      label: '找灵感',
      shortLabel: '灵感',
      className: navLinkClass('inspiration', active),
    },
    {
      href: '/skills',
      label: 'Skill 库',
      shortLabel: 'Skill',
      className: navLinkClass('skills', active),
    },
    {
      href: '/talk',
      label: '吐槽室',
      shortLabel: '吐槽',
      className: navLinkClass('talk', active),
    },
    {
      href: '/articles',
      label: '洞笔记',
      shortLabel: '笔记',
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
  const normalized = normalizeActive(active)
  const items = navItems ?? defaultNavItems(normalized)

  return (
    <nav className={`border-b ${borderClassName ?? navBarTintClass()} bg-[color:var(--color-nav-bg)] backdrop-blur-xl sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-[var(--color-accent-coding)] to-[var(--color-accent-app)] rounded-lg flex items-center justify-center">
              <span className="text-[var(--color-bg)] font-bold text-sm">空</span>
            </div>
            <span className="hidden md:block text-xl sm:text-2xl font-bold font-['Orbitron'] gradient-text truncate">
              {SITE_NAME}
            </span>
          </Link>

          <div className="flex items-center justify-end gap-2 sm:gap-5 min-w-0">
            {items.map((item) => (
              <Link key={`${item.href}:${item.label}`} href={item.href} className={item.className}>
                <span className="sm:hidden">{item.shortLabel || item.label}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            {actionLabel && actionHref && (
              <Link
                href={actionHref}
                className="cyber-button shrink-0 text-center px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold tracking-wide"
                title={actionLabel}
              >
                <span className="sm:hidden">管理</span>
                <span className="hidden sm:inline">{actionLabel}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
