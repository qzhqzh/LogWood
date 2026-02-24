import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ReviewList } from '@/components/review-list'

export const dynamic = 'force-dynamic'

function parseFeatures(features: string): string[] {
  try {
    return JSON.parse(features)
  } catch {
    return []
  }
}

export default async function CodingPage() {
  const targets = await prisma.target.findMany({
    where: { type: 'coding' },
    include: {
      _count: {
        select: { reviews: { where: { status: 'published' } } },
      },
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
    orderBy: { name: 'asc' },
  })

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
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <nav className="border-b border-purple-500/20 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">LW</span>
              </div>
              <span className="text-2xl font-bold font-['Orbitron'] gradient-text">LogWood</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/editor" className="text-gray-400 hover:text-cyan-400 transition-colors font-medium tracking-wide">
                AI Editor
              </Link>
              <Link href="/coding" className="text-purple-400 font-medium tracking-wide">
                AI Coding
              </Link>
              <Link href="/submit" className="cyber-button px-5 py-2 rounded-lg font-semibold tracking-wide">
                发布评测
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="mb-12">
          <div className="inline-block mb-4 px-4 py-1 border border-purple-500/30 rounded-full bg-purple-500/5">
            <span className="text-purple-400 text-sm tracking-widest uppercase">AI-POWERED CODING</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] mb-4">
            <span className="gradient-text">AI Coding</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            AI 编程助手评测 - 探索 GitHub Copilot、Claude Code、CodeWhisperer 等智能编程工具
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {targetsWithStats.map((target, index) => (
            <Link
              key={target.id}
              href={`/coding/${target.slug}`}
              className="cyber-card rounded-2xl p-6 group transition-all duration-300 hover:scale-105"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-4 mb-4">
                {target.logoUrl && (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-2 flex items-center justify-center">
                    <img
                      src={target.logoUrl}
                      alt={target.name}
                      className="w-10 h-10 rounded object-contain"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                    {target.name}
                  </h2>
                  {target.developer && (
                    <p className="text-sm text-gray-500">{target.developer}</p>
                  )}
                </div>
              </div>

              {target.description && (
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {target.description}
                </p>
              )}

              <div className="flex items-center gap-4 mb-4">
                {target.avgRating && (
                  <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-lg">
                    <span className="text-yellow-400 text-lg">★</span>
                    <span className="font-bold text-yellow-400">{target.avgRating}</span>
                  </div>
                )}
                <span className="text-gray-500 text-sm">
                  {target.reviewCount} 条评测
                </span>
              </div>

              {target.features.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {target.features.slice(0, 3).map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded"
                    >
                      {feature}
                    </span>
                  ))}
                  {target.features.length > 3 && (
                    <span className="px-2 py-1 bg-gray-500/10 text-gray-400 text-xs rounded">
                      +{target.features.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-purple-500/10 flex items-center justify-between">
                <span className="text-purple-400 text-sm group-hover:text-purple-300">查看详情</span>
                <span className="text-gray-500 group-hover:text-purple-400 transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
