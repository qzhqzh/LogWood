import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { CandidateStatus } from '@prisma/client'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { candidateStatusLabel, listCandidates } from '@/modules/candidate'

export const revalidate = 30

export const metadata: Metadata = buildMetadata({
  title: '候选评测',
  description: '观察中的项目短名单——试用、打分、评测，再决定是否晋升到工具收藏或画廊',
  path: '/candidates',
})

interface CandidatesPageProps {
  searchParams: Promise<{ status?: string }>
}

const STATUS_FILTERS: Array<{ key: string; label: string; status?: CandidateStatus }> = [
  { key: 'active', label: '进行中' },
  { key: 'watching', label: '观察中', status: CandidateStatus.watching },
  { key: 'evaluating', label: '评测中', status: CandidateStatus.evaluating },
  { key: 'all', label: '全部' },
]

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { status: statusRaw } = await searchParams
  const filter = STATUS_FILTERS.find((f) => f.key === statusRaw) || STATUS_FILTERS[0]

  const candidates = await listCandidates(
    filter.key === 'all'
      ? { includePromoted: true }
      : filter.status
        ? { status: filter.status }
        : undefined,
  )

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '候选评测', path: '/candidates' },
        ])}
      />
      <SiteNav
        active="candidates"
        actionLabel={isAdmin ? '管理候选' : undefined}
        actionHref={isAdmin ? '/candidates/manage' : undefined}
      />

      <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <p className="text-xs tracking-[0.28em] text-amber-300/90 uppercase mb-3">SHORTLIST · EVALUATE</p>
        <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">候选评测</h1>
        <p className="text-lg text-muted max-w-2xl leading-relaxed">
          这里放「可能值得留下」的项目。先观察、再试用打分；够好的，晋升到工具收藏或画廊。
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <Link
              key={item.key}
              href={item.key === 'active' ? '/candidates' : `/candidates?status=${item.key}`}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                filter.key === item.key
                  ? 'border-amber-400/50 bg-amber-500/10 text-amber-200'
                  : 'border-divider text-muted hover:text-amber-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {candidates.length === 0 ? (
          <div className="cyber-card rounded-2xl p-12 text-center">
            <p className="text-xl text-[var(--color-text-strong)] mb-2">短名单还空着</p>
            <p className="text-muted mb-6">把你想评的项目放进来。</p>
            {isAdmin && (
              <Link href="/candidates/manage" className="cyber-button px-6 py-3 rounded-lg inline-block">
                录入候选
              </Link>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {candidates.map((item) => (
              <Link
                key={item.id}
                href={`/candidates/${item.slug}`}
                className="cyber-card rounded-2xl p-5 group hover:scale-[1.01] transition-transform"
              >
                <div className="flex gap-4">
                  {item.previewImageUrl || item.logoUrl ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-black/30">
                      <Image
                        src={item.previewImageUrl || item.logoUrl || ''}
                        alt={item.title}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl shrink-0 bg-gradient-to-br from-amber-500/20 to-cyan-500/10 flex items-center justify-center text-amber-200 font-['Orbitron']">
                      {item.title.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-[var(--color-text-strong)] group-hover:text-amber-200 truncate">
                        {item.title}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded border border-amber-500/30 text-amber-200/90">
                        {candidateStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted line-clamp-2">{item.summary || '暂无简介'}</p>
                    <div className="mt-3 flex items-center gap-3 text-sm text-soft">
                      {item.avgRating != null ? (
                        <span className="text-yellow-400">★ {item.avgRating}</span>
                      ) : (
                        <span>暂无评分</span>
                      )}
                      <span>{item.reviewCount} 条评测</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  )
}
