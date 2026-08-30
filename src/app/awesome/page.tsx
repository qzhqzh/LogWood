import type { Metadata } from 'next'
import { AwesomeHubNav } from '@/components/awesome-hub-nav'
import { AwesomeProjectBoard } from '@/components/awesome-project-board'
import styles from '@/components/awesome-project-board.module.css'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { listAwesomeProjects } from '@/modules/candidate'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Awesome — Open-source Project Radar',
  description: 'A ranked, searchable radar of open-source projects ready for the next block of spare compute.',
  path: '/awesome',
})

export default async function AwesomePage() {
  const projects = await listAwesomeProjects()

  return (
    <main className={`${styles.page} ascii-app`}>
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: 'Awesome', path: '/awesome' },
      ])} />
      <SiteNav active="awesome" />
      <AwesomeHubNav active="projects" />
      <AwesomeProjectBoard initialProjects={projects} />
      <SiteFooter />
    </main>
  )
}
