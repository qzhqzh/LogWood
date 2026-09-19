import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { AwesomeHubNav } from '@/components/awesome-hub-nav'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import {
  listHubTokens, listMyHubSkills, listPendingHubSkills, listPublishedHubSkills,
} from '@/modules/agent-skill-hub/service'
import { AgentSkillHub } from './hub-client'
import styles from './hub.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Skill Hub — 发布、同步与下载 Agent Skill',
  description: '提交版本化的 Agent Skill 文件包，审核后公开下载。',
}

export default async function AgentSkillHubPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || null
  const admin = Boolean(userId && session?.user?.role === 'admin')
  const [published, mine, queue, tokens] = await Promise.all([
    listPublishedHubSkills(),
    userId ? listMyHubSkills(userId) : Promise.resolve([]),
    admin ? listPendingHubSkills() : Promise.resolve([]),
    userId ? listHubTokens(userId) : Promise.resolve([]),
  ])

  return (
    <main className={`${styles.page} ascii-app`}>
      <SiteNav active="awesome" />
      <AwesomeHubNav active="skills" />
      <AgentSkillHub published={published} mine={mine} queue={queue} tokens={tokens}
        signedIn={Boolean(userId)} admin={admin} />
      <SiteFooter />
    </main>
  )
}
