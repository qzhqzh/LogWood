import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { CandidateStatus } from '@prisma/client'
import { Recycle, Search } from 'lucide-react'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { listCandidates } from '@/modules/candidate'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: '废品站',
  description: '保存已经处理但当前不再继续的灵感、失败判断和替代线索。废品不是删除，结论仍然可以被复查。',
  path: '/scraps',
})

interface ScrapsPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function ScrapsPage({ searchParams }: ScrapsPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { q } = await searchParams
  const search = q?.trim() || ''
  const scraps = await listCandidates({ status: CandidateStatus.dropped, search })

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '废品站', path: '/scraps' },
        ])}
      />
      <SiteNav
        active="scraps"
        actionLabel={isAdmin ? 'Triage Inbox' : undefined}
        actionHref={isAdmin ? '/candidates/manage' : undefined}
      />

      <header className="border-b border-divider">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-rose-300">
                <Recycle className="h-4 w-4" aria-hidden />
                <span>有理由地放弃</span>
              </div>
              <h1 className="text-4xl font-bold text-[var(--color-text-strong)]">废品站</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                这里保存已经判断为暂不继续的内容。失败、过时和被替代都值得留下记录，它们仍可回到观察池重新处理。
              </p>
            </div>
            <div className="text-sm text-muted">
              <span className="font-semibold tabular-nums text-[var(--color-text-strong)]">{scraps.length}</span> 条淘汰记录
            </div>
          </div>

          <form action="/scraps" className="relative mt-7 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="搜索标题、备注或 Tag"
              className="h-11 w-full rounded-lg border border-divider bg-[var(--color-surface-1)] pl-10 pr-12 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-muted focus:border-rose-400"
            />
            <button
              type="submit"
              aria-label="搜索废品"
              title="搜索废品"
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-rose-200 hover:bg-rose-400/10 focus:outline-none focus:ring-2 focus:ring-rose-400"
            >
              <Search className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {scraps.length === 0 ? (
          <div className="rounded-lg border border-divider px-6 py-14 text-center">
            <p className="text-lg font-semibold text-[var(--color-text-strong)]">
              {search ? '没有找到对应记录' : '废品站暂时是空的'}
            </p>
            <p className="mt-2 text-sm text-muted">
              {search ? '调整搜索词继续查找。' : '在找灵感中完成判断后，不再继续的内容会出现在这里。'}
            </p>
            <Link href="/candidates" className="mt-5 inline-flex text-sm font-medium text-amber-200 hover:text-amber-100">
              返回找灵感 <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-divider border-y border-divider">
            {scraps.map((item) => (
              <article key={item.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center">
                {item.previewImageUrl || item.logoUrl ? (
                  <Link href={`/candidates/${item.slug}`} className="relative block aspect-square overflow-hidden rounded-md bg-black/20 sm:aspect-[4/3]">
                    <Image
                      src={item.previewImageUrl || item.logoUrl || ''}
                      alt={item.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </Link>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-md border border-divider text-rose-300 sm:aspect-[4/3]">
                    <Recycle className="h-5 w-5" aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">
                    <Link href={`/candidates/${item.slug}`} className="hover:text-rose-200">{item.title}</Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                    {item.summary || '暂未记录淘汰原因，可在详情中补充 Tags、吐槽或正式评测。'}
                  </p>
                  {item.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="rounded border border-divider px-2 py-0.5 text-xs text-soft">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="col-span-2 flex items-center gap-4 text-sm text-soft sm:col-span-1 sm:flex-col sm:items-end sm:gap-1">
                  <span>{item.reviewCount} 条记录</span>
                  <Link href={`/candidates/${item.slug}`} className="font-medium text-rose-300 hover:text-rose-200">
                    查看判断 <span aria-hidden>→</span>
                  </Link>
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
