import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { PromptWorkbench } from '@/components/prompt-workbench'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { candidatePreviewClientUrl } from '@/lib/private-candidate-preview'
import { listCandidates } from '@/modules/candidate'
import { getPromptRunnerModels, isPromptRunnerConfigured } from '@/modules/prompt-runner'
import {
  listPromptLibrary,
  promptOutputKind,
  skillCategoryLabel,
  withoutPromptOutputTag,
} from '@/modules/skill'
import { buildMetadata } from '@/shared/seo'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: 'Prompt Workbench',
  description: '选择、修改并测试公开 Prompt；测试结果不会自动保存或发布。',
  path: '/workbench',
})

interface WorkbenchPageProps {
  searchParams?: { prompt?: string; draft?: string }
}

export default async function WorkbenchPage({ searchParams }: WorkbenchPageProps) {
  const promptsPromise = listPromptLibrary({ limit: 100 })
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const [prompts, candidateDrafts] = await Promise.all([
    promptsPromise,
    isAdmin && session?.user?.id
      ? listCandidates({ authorUserId: session.user.id, limit: 100 })
      : Promise.resolve([]),
  ])
  const privateDrafts = candidateDrafts.filter((draft) => draft.visibility === 'private')
  const runnerState = !isAdmin
    ? 'signin'
    : isPromptRunnerConfigured()
      ? 'ready'
      : 'not-configured'

  return (
    <main className="ascii-app prompt-workbench-page">
      <SiteNav
        active="skills"
        actionLabel={isAdmin ? 'Manage Prompts' : undefined}
        actionHref={isAdmin ? '/skills/manage' : undefined}
      />
      <PromptWorkbench
        prompts={[...privateDrafts.map((draft) => ({
          id: draft.id,
          slug: draft.slug,
          title: draft.title,
          categoryLabel: 'DRAFT',
          summary: draft.summary,
          prompt: draft.rawContent || '',
          effectImageUrl: candidatePreviewClientUrl(draft.id, draft.previewImageUrl),
          effectNote: draft.summary,
          outputKind: promptOutputKind({ category: 'other', tags: draft.tags }),
          updatedAt: draft.updatedAt.toISOString(),
          recordType: 'candidate' as const,
          recordStatus: 'draft' as const,
          tags: withoutPromptOutputTag(draft.tags),
        })), ...prompts.map((prompt) => ({
          id: prompt.id,
          slug: prompt.slug,
          title: prompt.title,
          categoryLabel: skillCategoryLabel(prompt.category),
          summary: prompt.summary,
          prompt: prompt.prompt,
          effectImageUrl: prompt.effectImageUrl,
          effectNote: prompt.effectNote,
          outputKind: prompt.outputKind,
          updatedAt: prompt.updatedAt.toISOString(),
          recordType: 'skill' as const,
          recordStatus: 'published' as const,
          tags: prompt.tags,
        }))]}
        models={getPromptRunnerModels()}
        initialSlug={searchParams?.prompt?.trim()}
        initialDraftSlug={searchParams?.draft?.trim()}
        runnerState={runnerState}
        canManage={isAdmin}
        signInHref="/auth/signin?callbackUrl=%2Fworkbench"
      />
    </main>
  )
}
