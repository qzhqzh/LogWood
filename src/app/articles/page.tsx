import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { encodeArticleSlug, listArticles } from '@/modules/article'
import { SiteNav } from '@/components/site-nav'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage() {
  const { articles } = await listArticles({
    page: 1,
    pageSize: 24,
  })

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav active="articles" actionLabel="文章管理" actionHref="/articles/manage" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="mb-12">
          <div className="inline-block mb-4 px-4 py-1 border border-pink-500/30 rounded-full bg-pink-500/5">
            <span className="text-pink-400 text-sm tracking-widest uppercase">COMMUNITY ARTICLES</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">社区文章</h1>
          <p className="text-gray-400 text-lg max-w-2xl">沉淀方法论、使用经验与最佳实践。</p>
        </div>

        {articles.length === 0 ? (
          <div className="cyber-card rounded-2xl p-10 text-center text-gray-400">暂无文章，先去创建第一篇吧。</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${encodeArticleSlug(article.slug)}`}
                className="cyber-card rounded-2xl p-6 hover:scale-[1.01] transition-transform"
              >
                <h2 className="text-2xl font-semibold text-white mb-3">{article.title}</h2>
                {article.excerpt && <p className="text-gray-300 mb-4 line-clamp-3">{article.excerpt}</p>}
                <div className="flex items-center justify-between text-sm text-gray-500">
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
        )}
      </section>
    </main>
  )
}
