import type { Metadata } from 'next'
import { AwesomeHubNav } from '@/components/awesome-hub-nav'
import boardStyles from '@/components/awesome-project-board.module.css'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import {
  AWESOME_DESIGN_FEEDS,
  AWESOME_INTERFACE_FEEDS,
  AWESOME_MOTION_FEEDS,
} from '@/content/awesome-design-feeds'
import { AWESOME_DISCOVERY_FEEDS } from '@/content/awesome-projects'
import { AWESOME_SKILL_FEEDS } from '@/content/awesome-skills'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import styles from './page.module.css'

export const metadata: Metadata = buildMetadata({
  title: 'Discovery Feeds — Awesome',
  description: 'Source registers for open-source projects, inspectable Agent Skills, interface systems and motion references.',
  path: '/awesome/feeds',
})

export default function AwesomeFeedsPage() {
  const totalFeeds = AWESOME_DISCOVERY_FEEDS.length
    + AWESOME_SKILL_FEEDS.length
    + AWESOME_DESIGN_FEEDS.length

  return (
    <main className={`${boardStyles.page} ascii-app`}>
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: 'Awesome', path: '/awesome' },
        { name: 'Feeds', path: '/awesome/feeds' },
      ])} />
      <SiteNav active="awesome" />
      <AwesomeHubNav active="feeds" />

      <header className={boardStyles.header}>
        <div className={boardStyles.headerMain}>
          <h1>FEEDS</h1>
          <div className={boardStyles.statement}>
            <p>
              FOLLOW.<br />
              FILTER.<br />
              <strong>BUILD.</strong>
            </p>
            <span>DISCOVERY SOURCE REGISTER</span>
          </div>
        </div>
        <div className={boardStyles.headerRail} aria-label="Discovery feed status">
          <span>{totalFeeds} SOURCES</span>
          <span>{AWESOME_DISCOVERY_FEEDS.length} PROJECT FEEDS</span>
          <span>{AWESOME_SKILL_FEEDS.length} SKILL FEEDS</span>
          <span>{AWESOME_DESIGN_FEEDS.length} DESIGN FEEDS</span>
          <strong>UPSTREAM FIRST</strong>
        </div>
      </header>

      <div className={styles.register}>
        <div className={styles.column}>
          <FeedGroup
            title="PROJECT SOURCES"
            index="01"
            feeds={AWESOME_DISCOVERY_FEEDS}
          />
          <FeedGroup
            title="SKILL SOURCES"
            index="02"
            feeds={AWESOME_SKILL_FEEDS}
          />
        </div>
        <div className={styles.column}>
          <FeedGroup
            title="INTERFACE SYSTEMS"
            index="03"
            feeds={AWESOME_INTERFACE_FEEDS}
          />
          <FeedGroup
            title="MOTION + SPATIAL"
            index="04"
            feeds={AWESOME_MOTION_FEEDS}
          />
        </div>
      </div>

      <SiteFooter />
    </main>
  )
}

function FeedGroup({
  title,
  index,
  feeds,
}: {
  title: string
  index: string
  feeds: readonly { name: string; scope: string; url: string }[]
}) {
  return (
    <section className={styles.group} aria-labelledby={`feed-group-${index}`}>
      <header className={styles.groupHeader}>
        <span>{index}</span>
        <h2 id={`feed-group-${index}`}>{title}</h2>
        <small>{String(feeds.length).padStart(2, '0')} SOURCES</small>
      </header>
      <ol className={styles.list}>
        {feeds.map((feed, itemIndex) => (
          <li key={feed.url}>
            <a href={feed.url} target="_blank" rel="noopener noreferrer">
              <span className={styles.rowIndex}>{String(itemIndex + 1).padStart(2, '0')}</span>
              <span className={styles.identity}>
                <strong>{feed.name}</strong>
                <small>{feed.scope}</small>
              </span>
              <span className={styles.host}>{new URL(feed.url).hostname.replace('www.', '')}</span>
              <span className={styles.open}>OPEN ↗</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}
