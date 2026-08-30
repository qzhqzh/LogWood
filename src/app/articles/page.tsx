import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ArrowRight, NotebookPen } from 'lucide-react'
import { AiAttribution } from '@/components/ai-attribution'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { encodeArticleSlug, listArticles } from '@/modules/article'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 120

export const metadata: Metadata = buildMetadata({
  title: '笔记',
  description: '提示词、实验、比较与重新选择留下的长期记录；公开内容保留创作来源和 AI 归属。',
  path: '/articles',
})

interface ArticlesPageProps {
  searchParams?: { column?: string }
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const [session, articleResult] = await Promise.all([
    getServerSession(authOptions),
    listArticles({ page: 1, pageSize: 24 }),
  ])
  const isAdmin = isAdminSession(session)
  const selectedColumn = searchParams?.column?.trim() || 'all'
  const groupedArticles = new Map<string, { label: string; items: typeof articleResult.articles }>()

  for (const article of articleResult.articles) {
    const key = article.column?.id || 'unassigned'
    const label = article.column?.name || '未归入专栏'
    const group = groupedArticles.get(key)
    if (group) group.items.push(article)
    else groupedArticles.set(key, { label, items: [article] })
  }

  const groups = Array.from(groupedArticles.entries()).map(([key, group]) => ({ key, ...group }))
  const visibleGroups = selectedColumn === 'all' ? groups : groups.filter((group) => group.key === selectedColumn)
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <main className="ascii-app">
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: '笔记', path: '/articles' },
      ])} />
      <SiteNav
        active="articles"
        actionLabel={isAdmin ? 'Manage Notes' : undefined}
        actionHref={isAdmin ? '/articles/manage' : undefined}
      />

      <header className="ascii-page-header ascii-record-header">
        <div>
          <p className="ascii-kicker">[:: NOTES / HUMAN-VERIFIED RECORDS ::]</p>
          <h1>笔记</h1>
          <p>把提示词、实验、比较和失败写成长记录。AI 可以参与草稿，公开版本仍由人审核。</p>
        </div>
        <dl className="ascii-page-stats">
          <div><dt>公开笔记</dt><dd>{articleResult.total}</dd></div>
          <div><dt>当前显示</dt><dd>{visibleCount}</dd></div>
          <div><dt>专栏</dt><dd>{groups.length}</dd></div>
        </dl>
      </header>

      {articleResult.articles.length > 0 ? (
        <nav className="ascii-column-filter" aria-label="按专栏筛选笔记">
          <Link href="/articles" className={selectedColumn === 'all' ? 'is-active' : ''}>全部 · {articleResult.total}</Link>
          {groups.map((group) => (
            <Link
              key={group.key}
              href={`/articles?column=${encodeURIComponent(group.key)}`}
              className={selectedColumn === group.key ? 'is-active' : ''}
            >
              {group.label} · {group.items.length}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="ascii-article-groups">
        {visibleGroups.map((group, groupIndex) => (
          <section key={group.key} className="ascii-article-group" aria-labelledby={`article-group-${groupIndex}`}>
            <div className="ascii-panel__heading">
              <h2 id={`article-group-${groupIndex}`}>[:: {group.label} ::]</h2>
              <span>{group.items.length} 篇</span>
            </div>
            <div className="ascii-article-list">
              {group.items.map((article, index) => (
                <Link key={article.id} href={`/articles/${encodeArticleSlug(article.slug)}`}>
                  <span className="ascii-article-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="ascii-article-copy">
                    <strong>{article.title}</strong>
                    <small>{article.excerpt || '打开查看完整记录与创作来源。'}</small>
                    <AiAttribution
                      provider={article.aiProvider}
                      model={article.aiModel}
                      modelVersion={article.aiModelVersion}
                      generatedAt={article.aiGeneratedAt}
                    />
                  </span>
                  <span className="ascii-article-meta">
                    <time dateTime={(article.publishedAt || article.createdAt).toISOString()}>
                      {formatDistanceToNow(new Date(article.publishedAt || article.createdAt), { addSuffix: true, locale: zhCN })}
                    </time>
                    <small>{article.viewCount} 次阅读</small>
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        ))}

        {articleResult.articles.length === 0 || visibleGroups.length === 0 ? (
          <div className="ascii-panel ascii-empty-state">
            <NotebookPen className="h-8 w-8" aria-hidden />
            <h2>{articleResult.articles.length === 0 ? '还没有公开笔记' : '当前专栏没有公开笔记'}</h2>
            <p>草稿和未通过审核的版本不会出现在这里。</p>
            {visibleGroups.length === 0 && articleResult.articles.length > 0 ? <Link href="/articles" className="ascii-button">查看全部</Link> : null}
          </div>
        ) : null}
      </div>

      <SiteFooter />
    </main>
  )
}
