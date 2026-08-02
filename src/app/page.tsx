import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { CandidateStatus } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Archive, ArrowRight, Inbox, MessageSquareText, NotebookPen, Recycle, ScanSearch } from 'lucide-react'
import { JsonLd } from '@/components/json-ld'
import { QuickIdeaDialog } from '@/components/quick-idea-dialog'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encodeArticleSlug } from '@/modules/article'
import { listCandidates } from '@/modules/candidate'
import { listRecentCollection } from '@/modules/collection'
import { SITE_NAME, SITE_TAGLINE, buildMetadata, buildWebSite } from '@/shared/seo'
import { getReviewSubjectPresentation } from '@/shared/reviews/subject'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: `${SITE_NAME} - ${SITE_TAGLINE}`,
  description: '收住零散灵感，经过观察和判断进入收藏室或废品站，同时保存吐槽、证据和长期笔记。',
  path: '/',
})

const COLLECTION_KIND_LABELS = {
  ability: '能力',
  tool: '工具',
  visual: '视觉',
} as const

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const [
    inbox,
    scraps,
    collection,
    lifecycleCounts,
    latestArticles,
    latestReviews,
  ] = await Promise.all([
    listCandidates({ status: CandidateStatus.watching, limit: 5 }),
    listCandidates({ status: CandidateStatus.dropped, limit: 4 }),
    listRecentCollection(6),
    prisma.candidate.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.article.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      select: { id: true, slug: true, title: true, excerpt: true, publishedAt: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: { select: { name: true } },
        anonymousUser: { select: { displayName: true } },
        target: { select: { name: true, slug: true, type: true } },
        skill: { select: { title: true, slug: true } },
        app: { select: { title: true, slug: true } },
        candidate: { select: { title: true, slug: true } },
      },
    }),
  ])

  const countByStatus = new Map(lifecycleCounts.map((row) => [row.status, row._count._all]))

  const lifecycle = [
    { label: '待处理', count: countByStatus.get(CandidateStatus.watching) || 0, href: '/candidates', icon: Inbox, tone: 'text-amber-200' },
    { label: '观察中', count: countByStatus.get(CandidateStatus.evaluating) || 0, href: '/candidates?status=trying', icon: ScanSearch, tone: 'text-sky-200' },
    { label: '已入藏', count: countByStatus.get(CandidateStatus.promoted) || 0, href: '/candidates?status=collected', icon: Archive, tone: 'text-cyan-200' },
    { label: '已淘汰', count: countByStatus.get(CandidateStatus.dropped) || 0, href: '/scraps', icon: Recycle, tone: 'text-rose-200' },
  ]

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <JsonLd value={buildWebSite()} />
      <SiteNav />

      <header className="border-b border-divider">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-200">{SITE_TAGLINE}</p>
              <h1 className="mt-2 text-3xl font-bold text-[var(--color-text-strong)] sm:text-4xl">今天要处理什么？</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                先记下来，再判断要收入收藏室还是放进废品站。吐槽可以随时写，想明白以后再沉淀成洞笔记。
              </p>
            </div>
            <QuickIdeaDialog isAuthenticated={Boolean(session?.user?.id)} />
          </div>

          <nav aria-label="灵感生命周期" className="mt-8 grid overflow-hidden rounded-lg border border-divider sm:grid-cols-4">
            {lifecycle.map((item, index) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex min-h-20 items-center justify-between gap-3 px-4 py-3 hover:bg-white/5 ${index > 0 ? 'border-t border-divider sm:border-l sm:border-t-0' : ''}`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${item.tone}`} aria-hidden />
                    <span className="font-medium text-[var(--color-text-strong)]">{item.label}</span>
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-muted">{item.count}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <section className="border-b border-divider">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:px-8">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">待处理灵感</h2>
                <p className="mt-1 text-sm text-muted">保持收件箱短，先做最小判断。</p>
              </div>
              <Link href="/candidates" aria-label="查看全部待处理灵感" title="查看全部" className="rounded-md p-2 text-amber-200 hover:bg-amber-400/10">
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-5 divide-y divide-divider border-y border-divider">
              {inbox.length === 0 ? (
                <p className="py-8 text-sm text-muted">待处理池已经清空，可以记录下一条灵感。</p>
              ) : inbox.map((item) => (
                <Link key={item.id} href={`/candidates/${item.slug}`} className="block py-4 hover:bg-white/[0.025]">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-[var(--color-text-strong)]">{item.title}</h3>
                    <span className="shrink-0 text-xs text-soft">{item.tags.slice(0, 2).join(' · ')}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{item.summary || '等待补充为什么值得观察。'}</p>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">最近收藏</h2>
                <p className="mt-1 text-sm text-muted">按最近更新时间展示能力、工具和视觉收藏。</p>
              </div>
              <Link href="/skills" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">全部收藏</Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {collection.map((item) => (
                <Link key={item.id} href={item.href} className="flex min-h-24 gap-3 rounded-lg border border-divider p-3 hover:border-cyan-400/40">
                  {item.imageUrl ? (
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-black/20">
                      <Image src={item.imageUrl} alt={item.title} fill unoptimized className="object-cover" />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <span className="text-xs text-cyan-300">{COLLECTION_KIND_LABELS[item.kind]}</span>
                    <h3 className="mt-1 line-clamp-1 font-medium text-[var(--color-text-strong)]">{item.title}</h3>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">{item.summary}</p>
                  </div>
                </Link>
              ))}
              {collection.length === 0 ? <p className="py-8 text-sm text-muted">收藏室还没有内容。</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-divider">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">最近淘汰</h2>
              <p className="mt-1 text-sm text-muted">放弃结论保留在这里，后续仍可复查。</p>
            </div>
            <Link href="/scraps" className="text-sm font-medium text-rose-300 hover:text-rose-200">进入废品站</Link>
          </div>
          {scraps.length === 0 ? (
            <p className="mt-5 border-y border-divider py-8 text-sm text-muted">暂时没有淘汰记录。</p>
          ) : (
            <div className="mt-5 grid gap-x-8 border-y border-divider md:grid-cols-2">
              {scraps.map((item) => (
                <Link key={item.id} href={`/candidates/${item.slug}`} className="flex items-center justify-between gap-4 border-b border-divider py-4 last:border-b-0">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-[var(--color-text-strong)]">{item.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{item.summary || '等待补充淘汰理由。'}</p>
                  </div>
                  <Recycle className="h-4 w-4 shrink-0 text-rose-300" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-text-strong)]">
                <MessageSquareText className="h-5 w-5 text-purple-300" aria-hidden />
                最近吐槽
              </h2>
              <Link href="/talk" className="text-sm text-purple-300 hover:text-purple-200">全部吐槽</Link>
            </div>
            <div className="mt-5 divide-y divide-divider border-y border-divider">
              {latestReviews.map((review) => {
                const subject = getReviewSubjectPresentation(review)
                const authorName = review.user?.name || review.anonymousUser?.displayName || '匿名用户'
                return (
                  <article key={review.id} className="py-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-soft">
                      <span>{authorName}</span>
                      <span>{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: zhCN })}</span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{review.content}</p>
                    {subject ? <Link href={subject.href} className="mt-2 inline-flex text-xs text-purple-300 hover:text-purple-200">关于 {subject.title}</Link> : null}
                  </article>
                )
              })}
              {latestReviews.length === 0 ? <p className="py-8 text-sm text-muted">还没有吐槽记录。</p> : null}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-text-strong)]">
                <NotebookPen className="h-5 w-5 text-emerald-300" aria-hidden />
                最近笔记
              </h2>
              <Link href="/articles" className="text-sm text-emerald-300 hover:text-emerald-200">全部笔记</Link>
            </div>
            <div className="mt-5 divide-y divide-divider border-y border-divider">
              {latestArticles.map((article) => (
                <Link key={article.id} href={`/articles/${encodeArticleSlug(article.slug)}`} className="block py-4 hover:bg-white/[0.025]">
                  <h3 className="font-medium text-[var(--color-text-strong)]">{article.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{article.excerpt || '打开笔记查看完整内容。'}</p>
                  <p className="mt-2 text-xs text-soft">
                    {formatDistanceToNow(new Date(article.publishedAt || article.createdAt), { addSuffix: true, locale: zhCN })}
                  </p>
                </Link>
              ))}
              {latestArticles.length === 0 ? <p className="py-8 text-sm text-muted">还没有公开笔记。</p> : null}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
