import Link from 'next/link'
import React from 'react'
import styles from './awesome-hub-nav.module.css'

type AwesomeHubSection = 'projects' | 'skills' | 'feeds'

const ITEMS: Array<{ id: AwesomeHubSection; href: string; label: string }> = [
  { id: 'projects', href: '/awesome', label: 'PROJECTS' },
  { id: 'skills', href: '/awesome/skills', label: 'SKILLS' },
  { id: 'feeds', href: '/awesome/feeds', label: 'FEEDS' },
]

export function AwesomeHubNav({ active }: { active: AwesomeHubSection }) {
  return (
    <nav className={styles.nav} aria-label="Awesome sections">
      <span className={styles.index}>[ AWESOME / {active.toUpperCase()} ]</span>
      <div className={styles.links}>
        {ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active === item.id ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
