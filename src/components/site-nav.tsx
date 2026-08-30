import React from 'react'
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

type NavSection =
  | 'home'
  | 'inspiration'
  | 'skills'
  | 'scraps'
  | 'talk'
  | 'articles'
  | 'evaluations'
  | 'about'
  | 'gallery'
  | 'awesome'
  | 'forge'
  | 'candidates'
  | 'coding'
  | 'app'

type PublicSection = 'skills' | 'gallery' | 'awesome' | 'articles' | 'about'

interface SiteNavItem {
  href: string
  label: string
  shortLabel?: string
  className?: string
}

interface SiteNavProps {
  active?: NavSection
  actionLabel?: string
  actionShortLabel?: string
  actionHref?: string
  navItems?: SiteNavItem[]
  borderClassName?: string
}

function normalizeActive(active: NavSection): PublicSection | 'home' {
  if (
    active === 'skills'
    || active === 'gallery'
    || active === 'awesome'
    || active === 'articles'
    || active === 'about'
  ) {
    return active
  }
  if (active === 'coding' || active === 'forge') {
    return 'skills'
  }
  if (active === 'app') return 'gallery'
  if (active === 'evaluations' || active === 'talk' || active === 'scraps') return 'articles'
  return 'home'
}

const PUBLIC_NAV: Array<{ href: string; label: string; shortLabel: string; section: PublicSection }> = [
  { href: '/workbench', label: 'PROMPT', shortLabel: 'PROMPT', section: 'skills' },
  { href: '/gallery', label: 'GALLERY', shortLabel: 'GALLERY', section: 'gallery' },
  { href: '/awesome', label: 'AWESOME', shortLabel: 'AWESOME', section: 'awesome' },
  { href: '/articles', label: 'COMMUNITY', shortLabel: 'COMM.', section: 'articles' },
  { href: '/about', label: 'ABOUT', shortLabel: 'ABOUT', section: 'about' },
]

export function SiteNav({
  active = 'home',
  actionLabel,
  actionShortLabel,
  actionHref,
  navItems,
  borderClassName,
}: SiteNavProps) {
  const normalized = normalizeActive(active)
  const items = navItems ?? PUBLIC_NAV.map((item) => ({
    href: item.href,
    label: item.label,
    shortLabel: item.shortLabel,
    className: normalized === item.section ? 'is-active' : '',
  }))

  return (
    <nav className={`ascii-nav ${borderClassName ?? ''}`} aria-label="Primary navigation">
      <div className="ascii-nav__inner">
        <Link href="/" className="ascii-nav__brand" aria-label="KongXin home">
          <strong>KongXin</strong>
        </Link>

        <div className="ascii-nav__links">
          <div className="ascii-nav__routes">
            {items.map((item) => (
              <Link
                key={`${item.href}:${item.label}`}
                href={item.href}
                className={`ascii-nav__link ${item.className ?? ''}`}
              >
                <span className="sm:hidden">{item.shortLabel || item.label}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            {actionLabel && actionHref ? (
              <Link href={actionHref} className="ascii-nav__action" title={actionLabel}>
                <span className="sm:hidden">{actionShortLabel ?? 'Admin'}</span>
                <span className="hidden sm:inline">{actionLabel}</span>
              </Link>
            ) : null}
          </div>
          <ThemeToggle />
        </div>
      </div>
      <div className="ascii-signal-rule" aria-hidden="true">::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::</div>
    </nav>
  )
}
