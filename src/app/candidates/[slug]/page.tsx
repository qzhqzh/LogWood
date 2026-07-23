import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { EvaluationPanel } from '@/components/evaluation-panel'
import { ReviewPanel } from '@/components/review-panel'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { candidateStatusLabel, getCandidateBySlug } from '@/modules/candidate'

export const revalidate = 30

interface CandidateDetailProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CandidateDetailProps): Promise<Metadata> {
  const { slug } = await params
  const candidate = await getCandidateBySlug(slug)
  if (!candidate) return { title: 'Not Found' }
  return buildMetadata({
    title: `${candidate.title} - 灵感池`,
    description: candidate.summary || `等待试用与验证的灵感：${candidate.title}`,
    path: `/candidates/${candidate.slug}`,
  })
}

export default async function CandidateDetailPage({ params }: CandidateDetailProps) {
  const { slug } = await params
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const candidate = await getCandidateBySlug(slug)
  if (!candidate) notFound()

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '找灵感', path: '/candidates' },
          { name: candidate.title, path: `/candidates/${candidate.slug}` },
        ])}
      />
      <SiteNav
        active="candidates"
        actionLabel={isAdmin ? '管理' : undefined}
        actionHref={isAdmin ? `/candidates/manage?edit=${candidate.id}` : undefined}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/candidates" className="text-sm text-amber-300 hover:text-amber-200">
          ← 回灵感池
        </Link>

        <header className="mt-6 mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xs px-2 py-0.5 rounded border border-amber-500/30 text-amber-200">
              {candidateStatusLabel(candidate.status)}
            </span>
            {candidate.avgRating != null && (
              <span className="text-yellow-400 text-sm">★ {candidate.avgRating} · {candidate.reviewCount} 条真实记录</span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">
            {candidate.title}
          </h1>
          {candidate.summary && <p className="text-lg text-muted max-w-3xl">{candidate.summary}</p>}

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {candidate.websiteUrl && (
              <a href={candidate.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
                官网 ↗
              </a>
            )}
            {candidate.sourceUrl && (
              <a href={candidate.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-soft hover:text-muted">
                来源 ↗
              </a>
            )}
            {candidate.promotedTo === 'tool' && candidate.promotedTargetId && (
              <span className="text-emerald-300">已进入资源收藏；历史记录仍保留在本页</span>
            )}
            {candidate.promotedTo === 'gallery' && candidate.promotedAppId && (
              <Link href="/app" className="text-emerald-300 hover:text-emerald-200">已进入案例画廊 →</Link>
            )}
          </div>

          {candidate.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {candidate.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded border border-divider text-soft">{tag}</span>
              ))}
            </div>
          )}
        </header>

        {(candidate.previewImageUrl || candidate.logoUrl) && (
          <div className="relative w-full h-56 md:h-72 rounded-2xl overflow-hidden border border-divider mb-8">
            <Image
              src={candidate.previewImageUrl || candidate.logoUrl || ''}
              alt={candidate.title}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}

        <section className="cyber-card rounded-2xl p-5 mb-8">
          <p className="text-xs tracking-[0.25em] text-amber-300 uppercase mb-2">NEXT QUESTION</p>
          <p className="text-muted">
            它是否值得留下？请记录实际版本、使用场景、成功点和失败点。有效经验后续可以继续提炼为模板、Prompt、Workflow 或 Skill。
          </p>
        </section>

        <EvaluationPanel subjectType="candidate" subjectId={candidate.id} />
        <ReviewPanel
          subjectType="candidate"
          subjectId={candidate.id}
          canPublishReview={candidate.status !== 'promoted' && candidate.status !== 'dropped'}
          title="自由试用记录、提问或吐槽"
        />
      </article>

      <SiteFooter />
    </main>
  )
}
