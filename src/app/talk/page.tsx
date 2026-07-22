import type { Metadata } from 'next'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { getReviewSubjectPresentation } from '@/shared/reviews/subject'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: '吐槽室',
  description: '汇集模型、软件、资源与 Skill 的真实使用记录、踩坑、提问和阶段性判断。可以有情绪，但要区分事实与判断。',
  path: '/talk',
})

interface TalkPageProps {
  searchParams: Promise<{ sort?: string }>
}

export default async function TalkPage({ searchParams }: TalkPageProps) {
  const { sort: sortRaw } = await searchParams
  const sort = sortRaw === 'hot' ? 'hot' : 'latest'
  const orderBy = sort === 'hot'
    ? [{ likesCount: 'desc' as const }, { createdAt: 'desc' as const }]
    : [{ createdAt: 'desc' as const }]

  const reviews = await prisma.review.findMany({
    where: { status: 'published' },
    orderBy,
    take: 30,
    include: {
      user: { select: { name: true } },
      anonymousUser: { select: { displayName: true } },
      target: { select: { name: true, slug: true, type: true } },
      skill: { select: { title: true, slug: true } },
      app: { select: { title: true, slug: true } },
      candidate: { select: { title: true, slug: true } },
      _count: {
        select: {
          comments: { where: { status: 'published' } },
        },
      },
    },
  })

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '吐槽室', path: '/talk' },
        ])}
      />
      <SiteNav active="talk" />

      <header className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <p className="text-xs tracking-[0.28em] text-purple-300 uppercase mb-3">QUICK TAKES · REAL JOURNEY</p>
        <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">吐槽室</h1>
        <p className="text-lg text-muted max-w-3xl leading-relaxed">
          保存炼成途中真实的摩擦、失败、提问和阶段性判断。这里当前聚合全站自由评测；后续会进一步区分正式 Evaluation 与 Quick Take。
        </p>
        <p className="mt-4 text-sm text-soft max-w-3xl">
          可以有情绪，但要区分事实与判断；吐槽体验，不攻击个人；能说明版本、场景和证据的内容更有价值。
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/candidates" className="cyber-button px-5 py-2 rounded-lg font-semibold">
            找一个对象开始记录
          </Link>
          <Link href="/skills" className="px-5 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:border-cyan-400/60 transition-colors">
            浏览 Skill
          </Link>
          <div className="ml-auto flex gap-2">
            <Link
              href="/talk"
              className={`px-3 py-1.5 rounded-full border text-sm ${sort === 'latest' ? 'status-info' : 'border-divider text-muted hover-text-coding'}`}
            >
              最新
            </Link>
            <Link
              href="/talk?sort=hot"
              className={`px-3 py-1.5 rounded-full border text-sm ${sort === 'hot' ? 'status-info' : 'border-divider text-muted hover-text-coding'}`}
            >
              最热
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {reviews.length === 0 ? (
          <div className="cyber-card rounded-2xl p-12 text-center">
            <p className="text-xl text-[var(--color-text-strong)] mb-2">树洞暂时很安静</p>
            <p className="text-muted">打开一个灵感、资源或 Skill，写下第一条真实使用记录。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const subject = getReviewSubjectPresentation(review)
              const authorName = review.user?.name || review.anonymousUser?.displayName || '匿名用户'

              return (
                <article key={review.id} className="cyber-card rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {subject ? (
                          <Link href={subject.href} className="font-semibold text-coding hover:text-cyan-200">
                            {subject.title}
                          </Link>
                        ) : (
                          <span className="font-semibold text-muted">历史内容</span>
                        )}
                        {subject && (
                          <span className="text-xs px-2 py-0.5 rounded border border-divider text-soft">
                            {subject.kind}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-soft">
                        {authorName} · {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: zhCN })}
                      </p>
                    </div>
                    <div className="text-yellow-400 text-sm font-semibold">★ {review.rating}</div>
                  </div>

                  <p className="text-muted whitespace-pre-wrap break-words leading-relaxed">{review.content}</p>

                  <div className="mt-4 pt-4 border-t border-divider flex flex-wrap items-center gap-4 text-sm text-soft">
                    <span>👍 {review.likesCount}</span>
                    <span>回复 {review._count.comments}</span>
                    {subject && (
                      <Link href={subject.href} className="ml-auto text-cyan-300 hover:text-cyan-200">
                        查看对象与讨论 →
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
