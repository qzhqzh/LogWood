import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { encodeArticleSlug, listArticles } from '@/modules/article'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'

export const dynamic = 'force-dynamic'

interface ArticlesPageProps {
  searchParams?: {
    column?: string
  }
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { articles } = await listArticles({
    page: 1,
    pageSize: 24,
  })
  const selectedColumn = searchParams?.column?.trim() || 'all'

  const groupedArticles = new Map<string, { label: string; items: (typeof articles) }>()

  for (const article of articles) {
    const key = article.column?.id || 'unassigned'
    const label = article.column?.name || '未归入专栏'
    const group = groupedArticles.get(key)
    if (!group) {
      groupedArticles.set(key, { label, items: [article] })
    } else {
      group.items.push(article)
    }
  }

  const groups = Array.from(groupedArticles.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    items: group.items,
  }))

  const totalCount = articles.length
  const visibleGroups = selectedColumn === 'all'
    ? groups
    : groups.filter((group) => group.key === selectedColumn)

  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav
        active="articles"
        actionLabel={isAdmin ? '文章管理' : undefined}
        actionHref={isAdmin ? '/articles/manage' : undefined}
      />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="mb-12">
          <div className="inline-block mb-4 px-4 py-1 border border-[var(--color-danger-border)] rounded-full bg-[var(--color-danger-bg)]">
            <span className="text-[var(--color-danger-text)] text-sm tracking-widest uppercase">COMMUNITY ARTICLES</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">社区文章</h1>
          <p className="text-muted text-lg max-w-2xl">沉淀方法论、使用经验与最佳实践。</p>
        </div>

        {articles.length > 0 && (
          <section className="mb-10 cyber-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <p className="text-xs tracking-[0.28em] text-article uppercase mb-2">专栏统计</p>
                <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">按专栏筛选文章</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-['Orbitron'] text-article">{visibleCount}</div>
                <div className="text-xs text-soft">当前显示 / 总计 {totalCount}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/articles"
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  selectedColumn === 'all'
                    ? 'status-danger'
                    : 'border-divider text-muted hover:border-[var(--color-danger-border)] hover:text-[var(--color-danger-text)]'
                }`}
              >
                全部 · {totalCount}
              </Link>
              {groups.map((group) => (
                <Link
                  key={group.key}
                  href={`/articles?column=${encodeURIComponent(group.key)}`}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    selectedColumn === group.key
                      ? 'status-danger'
                      : 'border-divider text-muted hover:border-[var(--color-danger-border)] hover:text-[var(--color-danger-text)]'
                  }`}
                >
                  {group.label} · {group.items.length}
                </Link>
              ))}
            </div>
          </section>
        )}

        {articles.length === 0 ? (
          <div className="cyber-card rounded-2xl p-10 text-center text-muted">暂无文章，先去创建第一篇吧。</div>
        ) : (
          <div className="space-y-10">
            {visibleGroups.length === 0 && (
              <div className="cyber-card rounded-2xl p-10 text-center text-muted">当前筛选专栏暂无文章。</div>
            )}
            {visibleGroups.map((group) => (
              <section key={group.key}>
                <h2 className="text-xl font-semibold text-article mb-4">专栏：{group.label}</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {group.items.map((article: (typeof articles)[number]) => (
                    <Link
                      key={article.id}
                      href={`/articles/${encodeArticleSlug(article.slug)}`}
                      className="cyber-card rounded-2xl p-6 hover:scale-[1.01] transition-transform"
                    >
                      <h3 className="text-2xl font-semibold text-[var(--color-text-strong)] mb-3">{article.title}</h3>
                      {article.excerpt && <p className="text-muted mb-4 line-clamp-5">{article.excerpt}</p>}
                      <div className="flex items-center justify-between text-sm text-soft">
                        <span>
                          {formatDistanceToNow(new Date(article.publishedAt || article.createdAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </span>
                        <span>{article.viewCount} 次阅读</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  )
}
