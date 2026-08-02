import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Archive, BookOpenText, ChevronLeft, ChevronRight, ImageIcon, Search, Wrench } from 'lucide-react'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { COLLECTION_KINDS, CollectionKind, listCollection } from '@/modules/collection'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { SKILL_CATEGORIES } from '@/shared/skills/taxonomy'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: '收藏室',
  description: '统一收藏值得继续使用的能力、工具、资源和视觉案例，并保留原始详情与验证记录。',
  path: '/skills',
})

interface CollectionPageProps {
  searchParams: Promise<{ type?: string; q?: string; category?: string; page?: string }>
}

const FILTERS: Array<{
  key: CollectionKind
  label: string
  shortLabel: string
  icon: typeof BookOpenText
}> = [
  { key: 'all', label: '全部收藏', shortLabel: '全部', icon: Archive },
  { key: 'ability', label: '能力', shortLabel: '能力', icon: BookOpenText },
  { key: 'tool', label: '工具', shortLabel: '工具', icon: Wrench },
  { key: 'visual', label: '视觉', shortLabel: '视觉', icon: ImageIcon },
]

const KIND_LABELS = {
  ability: '能力',
  tool: '工具',
  visual: '视觉',
} as const

function collectionHref(kind: CollectionKind, search: string) {
  const params = new URLSearchParams()
  if (kind !== 'all') params.set('type', kind)
  if (search) params.set('q', search)
  const query = params.toString()
  return query ? `/skills?${query}` : '/skills'
}

function collectionPageHref(input: {
  kind: CollectionKind
  search: string
  category?: string
  page: number
}) {
  const params = new URLSearchParams()
  if (input.kind !== 'all') params.set('type', input.kind)
  if (input.search) params.set('q', input.search)
  if (input.kind === 'tool' && input.category) params.set('category', input.category)
  if (input.page > 1) params.set('page', String(input.page))
  const query = params.toString()
  return query ? `/skills?${query}` : '/skills'
}

export default async function CollectionPage({ searchParams }: CollectionPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { type, q, category: categoryRaw, page: pageRaw } = await searchParams
  const kind = COLLECTION_KINDS.includes(type as CollectionKind) ? type as CollectionKind : 'all'
  const search = q?.trim() || ''
  const category = kind === 'tool' && SKILL_CATEGORIES.some((item) => item.key === categoryRaw)
    ? categoryRaw
    : undefined
  const requestedPage = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1)
  const { items, counts, toolCategoryCounts, page, total, totalPages } = await listCollection({
    kind,
    search,
    category,
    page: requestedPage,
  })

  const action = kind === 'visual'
    ? { label: '管理视觉收藏', href: '/app/manage' }
    : kind === 'tool'
      ? { label: '管理历史工具', href: '/targets/manage/coding' }
      : { label: '管理能力', href: '/skills/manage' }

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '收藏室', path: '/skills' },
        ])}
      />
      <SiteNav
        active="skills"
        actionLabel={isAdmin ? action.label : undefined}
        actionHref={isAdmin ? action.href : undefined}
      />

      <header className="border-b border-divider">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium text-cyan-300">已经决定留下的内容</p>
              <h1 className="text-4xl font-bold text-[var(--color-text-strong)]">收藏室</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                能力、工具和视觉案例统一放在这里。底层历史模型保持不变，使用时不再需要先理解 Skill、Target 或 App 的区别。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link href="/candidates" className="text-amber-200 hover:text-amber-100">继续淘洗灵感</Link>
              <span className="text-soft" aria-hidden>·</span>
              <Link href="/scraps" className="text-muted hover:text-[var(--color-text-strong)]">查看废品站</Link>
            </div>
          </div>

          <form action="/skills" className="relative mt-7 max-w-xl">
            {kind !== 'all' && <input type="hidden" name="type" value={kind} />}
            {category && <input type="hidden" name="category" value={category} />}
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="搜索标题、说明、类型或 Tag"
              className="h-11 w-full rounded-lg border border-divider bg-[var(--color-surface-1)] pl-10 pr-12 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-muted focus:border-cyan-400"
            />
            <button
              type="submit"
              aria-label="搜索收藏"
              title="搜索收藏"
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-cyan-200 hover:bg-cyan-400/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <Search className="h-4 w-4" aria-hidden />
            </button>
          </form>

          <nav aria-label="收藏类型" className="mt-6 grid w-full grid-cols-4 gap-1 rounded-lg border border-divider bg-[var(--color-surface-1)] p-1 sm:flex sm:w-fit">
            {FILTERS.map((filter) => {
              const Icon = filter.icon
              const selected = filter.key === kind
              return (
                <Link
                  key={filter.key}
                  href={collectionHref(filter.key, search)}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-sm font-medium transition-colors sm:shrink-0 sm:gap-2 sm:px-3 ${
                    selected
                      ? 'bg-cyan-400/15 text-cyan-200'
                      : 'text-muted hover:bg-white/5 hover:text-[var(--color-text-strong)]'
                  }`}
                >
                  <Icon className="hidden h-4 w-4 sm:block" aria-hidden />
                  <span className="sm:hidden">{filter.shortLabel}</span>
                  <span className="hidden sm:inline">{filter.label}</span>
                  <span className="text-xs tabular-nums opacity-70">{counts[filter.key]}</span>
                </Link>
              )
            })}
          </nav>

          {kind === 'tool' ? (
            <nav aria-label="工具分类" className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 text-sm">
              <Link
                href={collectionHref('tool', search)}
                aria-current={!category ? 'page' : undefined}
                className={`shrink-0 rounded-md px-3 py-1.5 ${!category ? 'bg-white/10 text-[var(--color-text-strong)]' : 'text-muted hover:text-[var(--color-text-strong)]'}`}
              >
                全部工具 · {counts.tool}
              </Link>
              {SKILL_CATEGORIES.map((item) => (
                <Link
                  key={item.key}
                  href={`/skills?type=tool&category=${item.key}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                  aria-current={category === item.key ? 'page' : undefined}
                  className={`shrink-0 rounded-md px-3 py-1.5 ${category === item.key ? 'bg-white/10 text-[var(--color-text-strong)]' : 'text-muted hover:text-[var(--color-text-strong)]'}`}
                >
                  {item.label} · {toolCategoryCounts[item.key] || 0}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {items.length === 0 ? (
          <div className="rounded-lg border border-divider px-6 py-14 text-center">
            <p className="text-lg font-semibold text-[var(--color-text-strong)]">没有找到对应收藏</p>
            <p className="mt-2 text-sm text-muted">调整筛选或搜索词，也可以回到灵感池继续整理。</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article key={item.id} className="flex min-h-56 flex-col overflow-hidden rounded-lg border border-divider bg-[var(--color-surface-1)]">
                {item.imageUrl ? (
                  <Link href={item.href} className="relative block aspect-[16/7] overflow-hidden bg-black/20">
                    <Image src={item.imageUrl} alt={item.title} fill unoptimized className="object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
                  </Link>
                ) : null}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded border border-divider px-2 py-0.5 text-cyan-200">{KIND_LABELS[item.kind]}</span>
                    <span className="truncate text-soft">{item.typeLabel}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-[var(--color-text-strong)]">
                    <Link href={item.href} className="hover:text-cyan-200">{item.title}</Link>
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{item.summary}</p>
                  {item.origin ? (
                    <p className="mt-2 text-xs text-amber-200/90">
                      由灵感“
                      <Link href={item.origin.href} className="hover:text-amber-100">{item.origin.title}</Link>
                      ”整理入藏
                    </p>
                  ) : null}
                  {item.tags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded border border-divider px-2 py-0.5 text-xs text-soft">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <Link href={item.href} className="mt-auto pt-5 text-sm font-medium text-cyan-300 hover:text-cyan-200">
                    打开收藏 <span aria-hidden>→</span>
                  </Link>
                </div>
                </article>
              ))}
            </div>
            {totalPages > 1 ? (
              <nav aria-label="收藏分页" className="mt-8 flex items-center justify-between border-t border-divider pt-5">
                {page > 1 ? (
                  <Link
                    href={collectionPageHref({ kind, search, category, page: page - 1 })}
                    aria-label="上一页"
                    title="上一页"
                    className="rounded-md p-2 text-cyan-200 hover:bg-cyan-400/10"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Link>
                ) : <span className="h-8 w-8" aria-hidden />}
                <span className="text-sm tabular-nums text-muted">第 {page} / {totalPages} 页 · 共 {total} 条</span>
                {page < totalPages ? (
                  <Link
                    href={collectionPageHref({ kind, search, category, page: page + 1 })}
                    aria-label="下一页"
                    title="下一页"
                    className="rounded-md p-2 text-cyan-200 hover:bg-cyan-400/10"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : <span className="h-8 w-8" aria-hidden />}
              </nav>
            ) : null}
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
