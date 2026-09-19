import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { AwesomeHubNav } from '@/components/awesome-hub-nav'
import { AwesomeSkillBoard } from '@/components/awesome-skill-board'
import { HostedSkillShelf } from '@/components/hosted-skill-shelf'
import styles from '@/components/awesome-project-board.module.css'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { listPublishedHubSkills } from '@/modules/agent-skill-hub/service'
import { listAwesomeSkills } from '@/modules/candidate'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Skill Index — Awesome',
  description: 'A ranked, inspectable index of Agent Skills, their permissions, compatibility and maturity.',
  path: '/awesome/skills',
})

export default async function AwesomeSkillsPage({
  searchParams,
}: {
  searchParams?: { skill?: string }
}) {
  const [skills, hostedSkills, session] = await Promise.all([
    listAwesomeSkills(), listPublishedHubSkills(), getServerSession(authOptions),
  ])
  const selectedSlug = searchParams?.skill
  const initialExpandedSlug = skills.some((skill) => skill.slug === selectedSlug)
    ? selectedSlug
    : null

  return (
    <main className={`${styles.page} ascii-app`}>
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: 'Awesome', path: '/awesome' },
        { name: 'Skill Index', path: '/awesome/skills' },
      ])} />
      <SiteNav active="awesome" />
      <AwesomeHubNav active="skills" />
      <div className={styles.catalogToolbar}>
        <p>Skill Hub 托管可下载的文件包；外部 Skill 目录保留来源与审计资料。本站不自动运行 Skill。</p>
        <div>
          <Link href="/awesome/skills/hub">上传 / 同步 / 下载 Skill 包 →</Link>
          <Link href="/skills">可执行 Prompt 库 ↗</Link>
          {isAdminSession(session) ? <Link href="/awesome/skills/manage">管理外部 Skill 目录 ↗</Link> : null}
        </div>
      </div>
      <HostedSkillShelf skills={hostedSkills} />
      <AwesomeSkillBoard initialSkills={skills} initialExpandedSlug={initialExpandedSlug} />
      <SiteFooter />
    </main>
  )
}
