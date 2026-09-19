import Link from 'next/link'
import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { AwesomeHubNav } from '@/components/awesome-hub-nav'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { listManagedAgentSkills } from '@/modules/candidate/skill-catalog-management'
import { AgentSkillManager } from './skill-manager'
import styles from './skill-manager.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ManageAgentSkillsPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = Boolean(session?.user?.id && isAdminSession(session))
  const skills = isAdmin ? await listManagedAgentSkills() : []

  return (
    <main className={`${styles.page} ascii-app`}>
      <SiteNav active="awesome" />
      <AwesomeHubNav active="skills" />
      {isAdmin ? (
        <AgentSkillManager initialSkills={skills} />
      ) : (
        <section className={styles.access}>
          <p>SKILL CATALOG / ADMIN</p>
          <h1>管理员登录后才能整理 Skill 目录</h1>
          <div>
            <Link href="/auth/signin?callbackUrl=%2Fawesome%2Fskills%2Fmanage">前往登录 →</Link>
            <Link href="/awesome/skills">返回公开目录 ↗</Link>
          </div>
        </section>
      )}
      <SiteFooter />
    </main>
  )
}
