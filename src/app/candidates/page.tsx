import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { CandidateStatus } from '@prisma/client'
import { Search } from 'lucide-react'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { QuickIdeaDialog } from '@/components/quick-idea-dialog'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { candidateStatusLabel, listCandidates } from '@/modules/candidate'

export const revalidate = 30

export const metadata: Metadata = buildMetadata({
  title: '找灵感',
  description: '收住一个念头、一条链接或一个值得观察的 AI 资源，再通过试用、评测与讨论决定它是否值得继续炼成。',
  path: '/candidates',
})

interface CandidatesPageProps {
  searchParams: Promise<{ status?: string; q?: string }>
}

const STATUS_FILTERS: Array<{ key: string; label: string; status?: CandidateStatus }> = [
  { key: 'inbox', label: '未处理', status: CandidateStatus.watching },
  { key: 'good', label: '好灵感', status: CandidateStatus.evaluating },
  { key: 'bad', label: '不合适', status: CandidateStatus.dropped },
  { key: 'converted', label: '已转化', status: CandidateStatus.promoted },
  { key: 'all', label: '全部历史' },
]

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { status: statusRaw, q: searchRaw } = await searchParams
  const search = searchRaw?.trim() || ''
  const filter = STATUS_FILTERS.find((f) => f.key === statusRaw) || STATUS_FILTERS[0]

  const candidates = await listCandidates(
    filter.key === 'all'
      ? { includePromoted: true, search }
      : filter.status
        ? { status: filter.status, search }
        : undefined,
  )

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '找灵感', path: '/candidates' },
        ])}
      />
      <SiteNav
        active="candidates"
        actionLabel={isAdmin ? '管理灵感' : undefined}
        actionHref={isAdmin ? '/candidates/manage' : undefined}
      />

      <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <p className="text-xs tracking-[0.28em] text-amber-300/90 uppercase mb-3">INSPIRATION POOL · TRY · VERIFY</p>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] gradient-text">找灵感</h1>
          <QuickIdeaDialog isAuthenticated={Boolean(session?.user?.id)} />
        </div>
        <p className="text-lg text-muted max-w-3xl leading-relaxed">
          先收住碎片，再用 Tags 和归类快速整理。文字、工具和流程进入收藏室，视觉风格和图片案例进入画廊。
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-soft">
          <span className="px-3 py-1 rounded-full border border-amber-500/25 bg-amber-500/5">灵感</span>
          <span>→</span>
          <span className="px-3 py-1 rounded-full border border-amber-500/25 bg-amber-500/5">收藏室</span>
          <span className="text-soft">/</span>
          <span className="px-3 py-1 rounded-full border border-cyan-500/25 bg-cyan-500/5">画廊</span>
        </div>

        <form className="relative mt-7 max-w-xl" action="/candidates">
          {filter.key !== 'inbox' && <input type="hidden" name="status" value={filter.key} />}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="搜索标题、备注或 Tag"
            className="h-11 w-full rounded-lg border border-divider bg-black/20 pl-10 pr-24 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-soft focus:border-amber-400/60"
          />
          <button
            type="submit"
            className="absolute right-1 top-1 h-9 rounded-md px-4 text-sm text-amber-200 hover:bg-amber-400/10"
          >
            搜索
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <Link
              key={item.key}
              href={`${item.key === 'inbox' ? '/candidates' : `/candidates?status=${item.key}`}${
                search
                  ? `${item.key === 'inbox' ? '?' : '&'}q=${encodeURIComponent(search)}`
                  : ''
              }`}
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
            <p className="text-xl text-[var(--color-text-strong)] mb-2">灵感池还空着</p>
            <p className="text-muted mb-6">投下一条想法、链接或想验证的资源，不必等它变得完整。</p>
            {isAdmin && (
              <Link href="/candidates/manage" className="cyber-button px-6 py-3 rounded-lg inline-block">
                投下一颗灵感
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
                    <p className="mt-1 text-sm text-muted line-clamp-2">{item.summary || '暂时只有一颗种子，等待补充为什么值得观察。'}</p>
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded border border-divider px-1.5 py-0.5 text-xs text-soft">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-sm text-soft">
                      {item.avgRating != null ? (
                        <span className="text-yellow-400">★ {item.avgRating}</span>
                      ) : (
                        <span>等待首次试用</span>
                      )}
                      <span>{item.reviewCount} 条真实记录</span>
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
