import type { Metadata } from 'next'
import { AwesomeHubNav } from '@/components/awesome-hub-nav'
import { AwesomeSkillBoard } from '@/components/awesome-skill-board'
import styles from '@/components/awesome-project-board.module.css'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { listAwesomeSkills } from '@/modules/candidate'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Skill Index — Awesome',
  description: 'A ranked, inspectable index of Agent Skills, their permissions, compatibility and maturity.',
  path: '/awesome/skills',
})

export default async function AwesomeSkillsPage() {
  const skills = await listAwesomeSkills()

  return (
    <main className={`${styles.page} ascii-app`}>
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: 'Awesome', path: '/awesome' },
        { name: 'Skill Index', path: '/awesome/skills' },
      ])} />
      <SiteNav active="awesome" />
      <AwesomeHubNav active="skills" />
      <AwesomeSkillBoard initialSkills={skills} />
      <SiteFooter />
    </main>
  )
}
