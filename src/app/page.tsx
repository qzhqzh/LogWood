import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'

export const dynamic = 'force-dynamic'

const AI_CODING_TARGET_TYPES = ['editor', 'coding', 'model', 'prompt'] as const

function parseFeatures(features: string): string[] {
  try {
    return JSON.parse(features)
  } catch {
    return []
  }
}

export default async function HomePage() {
  const [targets, reviews, featuredApps, featuredArticles, aiCodingTargetsCount, appTargetsCount, communityArticleCount] = await Promise.all([
    prisma.target.findMany({
      include: {
        _count: {
          select: { reviews: { where: { status: 'published' } } },
        },
        reviews: {
          where: { status: 'published' },
          select: { rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.review.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        user: { select: { name: true } },
        anonymousUser: { select: { displayName: true } },
        target: { select: { name: true, slug: true, type: true } },
      },
    }),
    prisma.app.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
      },
    }),
    prisma.article.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
      },
    }),
    prisma.target.count({
      where: {
        type: { in: [...AI_CODING_TARGET_TYPES] },
      },
    }),
    prisma.app.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { status: 'published' } }),
  ])

  const targetsWithStats = targets.map((target) => {
    const ratings = target.reviews.map((r) => r.rating)
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null

    return {
      ...target,
      features: parseFeatures(target.features),
      avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      reviewCount: target._count.reviews,
    }
  })
  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav />

      <section className="relative pt-20 pb-32 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-500/5">
            <span className="text-cyan-400 text-sm tracking-widest uppercase">AI Coding Review Platform</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold font-['Orbitron'] mb-6 leading-tight">
            <span className="gradient-text">AI 编码工具</span>
            <br />
            <span className="text-white">评测社区</span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            沉淀真实评测数据，帮助开发者在{' '}
            <span className="text-cyan-400">AI Coding</span> 视角下统一比较{' '}
            <span className="text-white">AI Editor、AI Coding、AI Model、AI Prompt</span>
            {' '}4 个分区的工具、方法与实践内容
          </p>

          <div className="flex justify-center gap-4 mb-16">
            <Link href="/coding" className="cyber-button px-8 py-3 rounded-lg font-semibold text-lg tracking-wide">
              AI Coding
            </Link>
            <Link href="/app" className="px-8 py-3 rounded-lg font-semibold text-lg tracking-wide border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 transition-all">
              应用工坊
            </Link>
            <Link href="/articles" className="px-8 py-3 rounded-lg font-semibold text-lg tracking-wide border border-pink-500/50 text-pink-400 hover:bg-pink-500/10 transition-all">
              阅读社区文章
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-cyan-400 mb-2">{aiCodingTargetsCount}</div>
              <div className="text-gray-400 text-sm tracking-wide">AI Coding</div>
            </div>
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-purple-400 mb-2">{appTargetsCount}</div>
              <div className="text-gray-400 text-sm tracking-wide">应用工坊</div>
            </div>
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-pink-400 mb-2">{communityArticleCount}</div>
              <div className="text-gray-400 text-sm tracking-wide">社区文章</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">热门工具</h2>
              <p className="text-gray-500">探索最受关注的 AI 编码工具</p>
            </div>
            <Link href="/editor" className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-2">
              查看全部 <span>→</span>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {targetsWithStats.map((target, index) => (
              <Link
                key={target.id}
                href={`/${target.type}/${target.slug}`}
                className="cyber-card rounded-2xl p-6 group transition-all duration-300 hover:scale-105"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  {target.logoUrl && (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2 flex items-center justify-center">
                      <Image
                        src={target.logoUrl}
                        alt={target.name}
                        width={32}
                        height={32}
                        unoptimized
                        className="w-8 h-8 rounded object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {target.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      target.type === 'editor' 
                        ? 'bg-cyan-500/20 text-cyan-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {target.type === 'editor' ? 'EDITOR' : 'CODING'}
                    </span>
                  </div>
                </div>

                <p className="text-gray-500 text-sm mb-4 line-clamp-2">{target.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {target.avgRating && (
                      <>
                        <span className="text-yellow-400 text-lg">★</span>
                        <span className="font-bold text-white">{target.avgRating}</span>
                      </>
                    )}
                  </div>
                  <span className="text-gray-500 text-sm">{target.reviewCount} 条评测</span>
                </div>

                {target.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {target.features.slice(0, 2).map((feature) => (
                      <span
                        key={feature}
                        className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded"
                      >
                        {feature}
                      </span>
                    ))}
                    {target.features.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 text-xs rounded">
                        +{target.features.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 border-t border-cyan-500/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">应用工坊</h2>
              <p className="text-gray-500">精选应用展示</p>
            </div>
            <Link href="/app" className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2">
              查看全部 <span>→</span>
            </Link>
          </div>

          {featuredApps.length === 0 ? (
            <div className="cyber-card rounded-2xl p-8 text-center text-gray-500">暂无应用工坊内容</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {featuredApps.map((app) => (
                <Link
                  key={app.id}
                  href={`/app/${app.slug}`}
                  className="cyber-card rounded-2xl p-6 group transition-all duration-300 hover:scale-105"
                >
                  <h3 className="text-xl font-semibold text-white group-hover:text-purple-300 transition-colors mb-3 line-clamp-2">
                    {app.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3">{app.summary}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 px-4 border-t border-cyan-500/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">社区文章</h2>
              <p className="text-gray-500">最新文章</p>
            </div>
            <Link href="/articles" className="text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-2">
              查看全部 <span>→</span>
            </Link>
          </div>

          {featuredArticles.length === 0 ? (
            <div className="cyber-card rounded-2xl p-8 text-center text-gray-500">暂无社区文章</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="cyber-card rounded-2xl p-5 group transition-all duration-300 hover:scale-105"
                >
                  <h3 className="text-lg font-semibold text-white group-hover:text-pink-300 transition-colors mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3">{article.excerpt || '暂无摘要'}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 px-4 border-t border-cyan-500/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">最新评测</h2>
            <p className="text-gray-500">来自社区的真实使用体验</p>
          </div>

          {reviews.length === 0 ? (
            <div className="cyber-card rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-white mb-2">暂无评测数据</h3>
              <p className="text-gray-500 mb-6">成为第一个发布评测的人吧！</p>
              <Link href="/coding" className="cyber-button px-6 py-2 rounded-lg inline-block">
                前往 AI Coding
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review) => {
                const targetHref = review.target
                  ? `/${review.target.type}/${review.target.slug}`
                  : '/coding'

                return (
                <Link
                  key={review.id}
                  href={targetHref}
                  className="cyber-card rounded-2xl p-6 group transition-all duration-300 hover:scale-105"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                        <span className="text-sm">{review.user ? '👤' : '🎭'}</span>
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {review.user?.name || review.anonymousUser?.displayName || '匿名用户'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(review.createdAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded">
                      <span className="text-yellow-400">★</span>
                      <span className="font-bold text-yellow-400">{review.rating}</span>
                    </div>
                  </div>

                  {review.target && (
                    <div className="text-sm text-cyan-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      {review.target.name}
                    </div>
                  )}
                  <p className="text-gray-400 line-clamp-3 mb-4">{review.content}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <span>👍</span> {review.likesCount}
                    </span>
                    <span className="text-cyan-400 group-hover:text-cyan-300">查看工具页 →</span>
                  </div>
                </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
