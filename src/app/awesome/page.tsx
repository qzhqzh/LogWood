import type { Metadata } from 'next'
import { AwesomeProjectBoard } from '@/components/awesome-project-board'
import styles from '@/components/awesome-project-board.module.css'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { listAwesomeProjects } from '@/modules/candidate'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Awesome Project Queue',
  description: '值得投入的开源项目与建设方向候选池：连接真实上游、本站能力缺口、最小可交付和集体兴趣评分。',
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
      <AwesomeProjectBoard initialProjects={projects} />
      <SiteFooter />
    </main>
  )
}
