import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { ScientificCoverWorkbench } from '@/components/scientific-cover-workbench'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { getPromptRunnerModels } from '@/modules/prompt-runner'
import { listScientificCoverProfiles } from '@/modules/scientific-cover'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Scientific Cover Forge',
  description: '从脱敏科研简报生成可追溯的期刊封面概念候选，并保留政策、提示词与模型证据链。',
  robots: { index: false, follow: false },
}

interface ScientificCoverPageProps {
  searchParams?: { run?: string }
}

export default async function ScientificCoverPage({ searchParams }: ScientificCoverPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const models = getPromptRunnerModels()
    .filter((model) => model.outputType === 'image')
    .map((model) => ({
      id: model.id,
      label: model.label,
      provider: model.provider,
      configured: model.configured,
    }))
  const runnerState = !isAdmin
    ? 'signin'
    : models.some((model) => model.configured)
      ? 'ready'
      : 'not-configured'

  return (
    <main className={`ascii-app style-gallery-page ${styles.page}`}>
      <div
        aria-hidden="true"
        className="hidden"
        dangerouslySetInnerHTML={{
          __html: `<!--
THESIS: A journal cover concept is a traceable editorial argument, not a decorative one-shot image and never experimental evidence.
OWN-WORLD: Cover Proof Press extends Gallery with full-color portrait proofs, near-black or warm-paper fields, square rules, mint controls, and amber policy evidence.
STORY: Redact the research brief, bind it to one journal policy, register six exact prompts, generate each candidate, compare the contact sheet, then make a visibly provisional human shortlist.
FIRST VIEWPORT: Brief press at left, one dominant portrait proof at center, six-candidate strip below, and policy/provenance inspector at right.
FORM: Operate surface inside the established Living Contact Sheet world; no popularity feed, fake scientific score, or submission-ready claim.
FINISH: The page ends at draft human selection; structured review, audit, and technical finalization remain explicit later gates.
-->`,
        }}
      />
      <SiteNav active="gallery" />
      <ScientificCoverWorkbench
        profiles={listScientificCoverProfiles()}
        models={models}
        runnerState={runnerState}
        signInHref="/auth/signin?callbackUrl=%2Fgallery%2Fcover-forge"
        initialRunId={searchParams?.run?.trim()}
      />
      <SiteFooter />
    </main>
  )
}
