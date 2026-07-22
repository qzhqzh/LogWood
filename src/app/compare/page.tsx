import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import {
  getTargetsByIds,
  listTargetsByCompareGroup,
  type TargetCompareCard,
} from '@/modules/target'
import {
  skillCategoryLabel,
  skillDetailPath,
} from '@/shared/skills/taxonomy'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: '资源对比',
  description: '并排比较历史资源收藏的效果图、评分与近期使用记录',
  path: '/compare',
})

interface ComparePageProps {
  searchParams: Promise<{ ids?: string; group?: string }>
}

function parseIds(raw?: string): string[] {
  if (!raw) return []
  return raw.split(',').map((value) => value.trim()).filter(Boolean).slice(0, 4)
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { ids: idsRaw, group } = await searchParams
  const ids = parseIds(idsRaw)

  let cards: TargetCompareCard[] = []
  if (ids.length >= 2) {
    cards = await getTargetsByIds(ids)
  } else if (group?.trim()) {
    const grouped = await listTargetsByCompareGroup(group.trim())
    cards = await getTargetsByIds(grouped.slice(0, 4).map((target) => target.id))
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '资源收藏', path: '/tools' },
          { name: '资源对比', path: '/compare' },
        ])}
      />
      <SiteNav active="inspiration" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="mb-10">
          <div className="inline-block mb-4 px-4 py-1 border border-purple-500/30 rounded-full bg-purple-500/5">
            <span className="text-purple-400 text-sm tracking-widest uppercase">COMPARE</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] mb-4 gradient-text">资源对比</h1>
          <p className="text-muted text-lg max-w-2xl">
            并排查看历史资源的效果图、评分与近期真实记录。用法：`/compare?ids=id1,id2` 或 `/compare?group=分组键`。
          </p>
        </div>

        {cards.length < 2 ? (
          <div className="cyber-card rounded-2xl p-10 text-center">
            <p className="text-muted mb-6">
              至少需要 2 个资源。可在资源管理中填写「对比分组键」，或用 ids 参数打开本页。
            </p>
            <Link href="/tools" className="cyber-button px-6 py-2 rounded-lg inline-block">
              回资源收藏
            </Link>
          </div>
        ) : (
          <div className={`grid gap-6 ${cards.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
            {cards.map((card) => (
              <article key={card.id} className="cyber-card rounded-2xl overflow-hidden flex flex-col">
                <div className="relative h-48 bg-gradient-to-br from-cyan-500/10 to-purple-500/10">
                  {card.previewImageUrl ? (
                    <Image src={card.previewImageUrl} alt={card.name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-soft text-sm">暂无效果或证据</div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <p className="text-xs text-purple-300 tracking-wide mb-1">{skillCategoryLabel(card.type)}</p>
                  <Link
                    href={skillDetailPath(card.type, card.slug)}
                    className="text-2xl font-bold text-[var(--color-text-strong)] hover:text-cyan-300 transition-colors mb-2"
                  >
                    {card.name}
                  </Link>
                  <p className="text-muted text-sm line-clamp-3 mb-4">{card.description || '暂无描述'}</p>

                  <div className="flex items-center gap-4 mb-4 text-sm">
                    {card.avgRating != null && (
                      <span className="text-yellow-400 font-semibold">★ {card.avgRating}</span>
                    )}
                    <span className="text-soft">{card._count?.reviews ?? 0} 条真实记录</span>
                  </div>

                  {card.sourceUrl && (
                    <a
                      href={card.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 mb-4"
                    >
                      查看来源 ↗
                    </a>
                  )}

                  <div className="mt-auto border-t border-divider pt-4 space-y-3">
                    <p className="text-xs tracking-widest text-soft uppercase">近期记录</p>
                    {card.recentReviews.length === 0 ? (
                      <p className="text-sm text-soft">还没有记录</p>
                    ) : (
                      card.recentReviews.map((review) => (
                        <div key={review.id} className="text-sm">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-soft">{review.authorName}</span>
                            <span className="text-yellow-400">★ {review.rating}</span>
                          </div>
                          <p className="text-muted line-clamp-2">{review.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  )
}
