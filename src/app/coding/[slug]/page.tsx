import Link from 'next/link'
import { notFound } from 'next/navigation'
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

interface TargetPageProps {
  params: Promise<{ slug: string }>
}

export default async function CodingDetailPage({ params }: TargetPageProps) {
  const { slug } = await params
  
  const target = await prisma.target.findFirst({
    where: { slug, type: 'coding' },
    include: {
      reviews: {
        where: { status: 'published' },
        select: { rating: true, category: true },
      },
    },
  })

  if (!target) {
    notFound()
  }

  const features = parseFeatures(target.features)
  const ratings = target.reviews.map((r) => r.rating)
  const avgRating = ratings.length > 0
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const categoryStats: Record<string, number> = {}

  target.reviews.forEach((r) => {
    ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1
    categoryStats[r.category] = (categoryStats[r.category] || 0) + 1
  })

  const totalReviews = target.reviews.length

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
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
        <div className="cyber-card rounded-3xl p-8 mb-8" style={{ borderColor: 'rgba(191, 0, 255, 0.2)' }}>
          <div className="flex items-start gap-6">
            {target.logoUrl && (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-3 flex items-center justify-center">
                <img
                  src={target.logoUrl}
                  alt={target.name}
                  className="w-14 h-14 rounded object-contain"
                />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold font-['Orbitron'] text-white mb-2">{target.name}</h1>
              {target.developer && (
                <p className="text-gray-500">开发者: {target.developer}</p>
              )}
              {target.description && (
                <p className="text-gray-400 mt-3">{target.description}</p>
              )}
              {target.websiteUrl && (
                <a
                  href={target.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 mt-2 inline-block transition-colors"
                >
                  访问官网 →
                </a>
              )}
            </div>
            <div className="text-right">
              {avgRating && (
                <div className="text-4xl font-bold font-['Orbitron']">
                  <span className="text-yellow-400">★</span> <span className="text-white">{avgRating.toFixed(1)}</span>
                </div>
              )}
              <div className="text-gray-500 mt-1">{totalReviews} 条评测</div>
            </div>
          </div>

          {features.length > 0 && (
            <div className="mt-6 pt-6 border-t border-purple-500/10">
              <h3 className="text-sm font-medium text-gray-500 mb-3 tracking-wide">功能标签</h3>
              <div className="flex flex-wrap gap-2">
                {features.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-sm"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="cyber-card rounded-2xl p-6" style={{ borderColor: 'rgba(191, 0, 255, 0.2)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold font-['Orbitron'] gradient-text">评测列表</h2>
                <Link
                  href={`/submit?targetId=${target.id}`}
                  className="cyber-button px-4 py-2 rounded-lg text-sm"
                >
                  发布评测
                </Link>
              </div>
              <ReviewList targetId={target.id} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="cyber-card rounded-2xl p-6" style={{ borderColor: 'rgba(191, 0, 255, 0.2)' }}>
              <h3 className="text-lg font-semibold font-['Orbitron'] text-white mb-4">评分分布</h3>
              {totalReviews > 0 ? (
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = ratingDistribution[rating]
                    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="w-8 text-sm text-gray-500">{rating}分</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-8 text-sm text-gray-500 text-right">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无评分数据</p>
              )}
            </div>

            {Object.keys(categoryStats).length > 0 && (
              <div className="cyber-card rounded-2xl p-6" style={{ borderColor: 'rgba(191, 0, 255, 0.2)' }}>
                <h3 className="text-lg font-semibold font-['Orbitron'] text-white mb-4">功能分类</h3>
                <div className="space-y-2">
                  {Object.entries(categoryStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-gray-400">{category}</span>
                        <span className="text-purple-400 text-sm">{count} 条</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
