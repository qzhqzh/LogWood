import Link from 'next/link'
import { ArticleSourceKind } from '@prisma/client'
import { Bot, GitCommitHorizontal, Link2, ShieldCheck, UserRound } from 'lucide-react'
import { AiAttribution } from '@/components/ai-attribution'

interface ArticleSourceView {
  id: string
  kind: ArticleSourceKind
  label: string
  sourceUrl: string | null
  candidate: { title: string; slug: string } | null
  skill: { title: string; slug: string } | null
  target: { name: string; slug: string; type: string } | null
  app: { title: string; slug: string } | null
  evaluation: { id: string; title: string } | null
  review: { id: string } | null
}

interface ArticleContributionView {
  id: string
  kind: 'human' | 'ai'
  role: string
  summary: string | null
  aiProvider: string | null
  aiModel: string | null
  aiModelVersion: string | null
  aiGeneratedAt: Date | null
  createdAt: Date
  actor: { id: string; name: string | null } | null
}

interface ArticleVersionView {
  id: string
  version: number
  changeSummary: string | null
  aiProvider: string | null
  aiModel: string | null
  aiModelVersion: string | null
  aiGeneratedAt: Date | null
  createdAt: Date
}

function sourceHref(source: ArticleSourceView) {
  if (source.candidate) return `/candidates/${source.candidate.slug}`
  if (source.skill) return `/skills/${source.skill.slug}`
  if (source.target) return `/${source.target.type}/${source.target.slug}`
  if (source.app) return `/app/${source.app.slug}`
  if (source.evaluation) return `/evaluations/${source.evaluation.id}`
  return source.sourceUrl
}

const SOURCE_LABELS: Record<ArticleSourceKind, string> = {
  inspiration: '来源灵感',
  reference: '参考资料',
  evidence: '证据',
  review: '讨论记录',
  evaluation: '正式评测',
}

export function ArticleProvenance({
  currentVersion,
  approvedVersion,
  reviewerName,
  sources,
  contributions,
  versions,
}: {
  currentVersion: number
  approvedVersion: number | null
  reviewerName?: string | null
  sources: ArticleSourceView[]
  contributions: ArticleContributionView[]
  versions: ArticleVersionView[]
}) {
  return (
    <aside className="mt-8 border-y border-divider py-6" aria-labelledby="article-provenance-heading">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[var(--color-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden />
            <span id="article-provenance-heading">Inspector / 创作与发布记录</span>
          </span>
          <span className="text-xs font-normal text-soft">v{currentVersion} · {sources.length} 个来源 · {contributions.length} 项贡献</span>
        </summary>

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <section aria-labelledby="source-list-heading">
            <h3 id="source-list-heading" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
              <Link2 className="h-4 w-4 text-cyan-300" aria-hidden />
              来源
            </h3>
            <div className="mt-4 space-y-4">
              {sources.length > 0 ? sources.map((source) => {
                const href = sourceHref(source)
                const content = (
                  <>
                    <span className="block text-xs text-soft">{SOURCE_LABELS[source.kind]}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted">{source.label}</span>
                  </>
                )
                return href ? (
                  href.startsWith('/') ? (
                    <Link key={source.id} href={href} className="block hover:text-cyan-200">{content}</Link>
                  ) : (
                    <a key={source.id} href={href} target="_blank" rel="noopener noreferrer" className="block hover:text-cyan-200">{content}</a>
                  )
                ) : <div key={source.id}>{content}</div>
              }) : <p className="text-sm leading-6 text-soft">历史文章尚未补录结构化来源。</p>}
            </div>
          </section>

          <section aria-labelledby="contribution-list-heading">
            <h3 id="contribution-list-heading" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
              <UserRound className="h-4 w-4 text-purple-300" aria-hidden />
              人与 AI 贡献
            </h3>
            <div className="mt-4 space-y-4">
              {contributions.length > 0 ? contributions.map((contribution) => (
                <div key={contribution.id}>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    {contribution.kind === 'ai'
                      ? <Bot className="h-4 w-4 text-cyan-300" aria-hidden />
                      : <UserRound className="h-4 w-4 text-amber-300" aria-hidden />}
                    <span>{contribution.kind === 'ai' ? 'AI' : contribution.actor?.name || '人工'} · {contribution.role}</span>
                  </div>
                  {contribution.summary ? <p className="mt-1 text-xs leading-5 text-soft">{contribution.summary}</p> : null}
                  {contribution.kind === 'ai' ? (
                    <AiAttribution
                      provider={contribution.aiProvider}
                      model={contribution.aiModel}
                      modelVersion={contribution.aiModelVersion}
                      generatedAt={contribution.aiGeneratedAt}
                      className="mt-1"
                    />
                  ) : null}
                </div>
              )) : <p className="text-sm leading-6 text-soft">历史文章尚未补录贡献明细。</p>}
            </div>
          </section>

          <section aria-labelledby="version-list-heading">
            <h3 id="version-list-heading" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
              <GitCommitHorizontal className="h-4 w-4 text-pink-300" aria-hidden />
              版本与门禁
            </h3>
            <p className="mt-4 text-sm leading-6 text-muted">
              当前 v{currentVersion}；批准版本 {approvedVersion ? `v${approvedVersion}` : '未记录'}
              {reviewerName ? `；审核人 ${reviewerName}` : ''}。
            </p>
            <ol className="mt-4 space-y-3">
              {versions.slice(0, 5).map((version) => (
                <li key={version.id} className="text-xs leading-5 text-soft">
                  <span className="font-semibold text-muted">v{version.version}</span>
                  {' · '}{version.changeSummary || '版本快照'}
                </li>
              ))}
              {versions.length === 0 ? <li className="text-sm leading-6 text-soft">历史文章尚未生成版本快照。</li> : null}
            </ol>
          </section>
        </div>
      </details>
    </aside>
  )
}
