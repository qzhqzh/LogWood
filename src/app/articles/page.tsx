import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { encodeArticleSlug, listArticles } from '@/modules/article'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage() {
  const { articles } = await listArticles({
    page: 1,
    pageSize: 24,
  })

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <nav className="border-b border-cyan-500/20 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold font-['Orbitron'] gradient-text">LogWood</Link>
            <div className="flex items-center gap-5">
              <Link href="/editor" className="text-gray-300 hover:text-cyan-400">AI Editor</Link>
              <Link href="/coding" className="text-gray-300 hover:text-purple-400">AI Coding</Link>
              <Link href="/articles/manage" className="text-cyan-300 hover:text-cyan-200">文章管理</Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-bold font-['Orbitron'] gradient-text mb-3">社区文章</h1>
          <p className="text-gray-400">沉淀方法论、使用经验与最佳实践。</p>
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
