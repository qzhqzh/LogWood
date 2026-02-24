import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ReviewList } from '@/components/review-list'

export const dynamic = 'force-dynamic'

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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-primary-600">
              LogWood
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/editor" className="text-gray-600 hover:text-gray-900">
                AI Editor
              </Link>
              <Link href="/coding" className="text-primary-600 font-medium">
                AI Coding
              </Link>
              <Link href="/submit" className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
                发布评测
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border p-8 mb-8">
          <div className="flex items-start gap-6">
            {target.logoUrl && (
              <img
                src={target.logoUrl}
                alt={target.name}
                className="w-20 h-20 rounded-xl object-contain"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{target.name}</h1>
              {target.developer && (
                <p className="text-gray-500 mt-1">开发者: {target.developer}</p>
              )}
              {target.description && (
                <p className="text-gray-600 mt-3">{target.description}</p>
              )}
              {target.websiteUrl && (
                <a
                  href={target.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline mt-2 inline-block"
                >
                  访问官网 →
                </a>
              )}
            </div>
            <div className="text-right">
              {avgRating && (
                <div className="text-4xl font-bold text-gray-900">
                  <span className="text-yellow-500">★</span> {avgRating.toFixed(1)}
                </div>
              )}
              <div className="text-gray-500 mt-1">{totalReviews} 条评测</div>
            </div>
          </div>

          {target.features.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-medium text-gray-500 mb-3">功能标签</h3>
              <div className="flex flex-wrap gap-2">
                {target.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
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
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">评测列表</h2>
                <Link
                  href={`/submit?targetId=${target.id}`}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm"
                >
                  发布评测
                </Link>
              </div>
              <ReviewList targetId={target.id} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">评分分布</h3>
              {totalReviews > 0 ? (
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = ratingDistribution[rating]
                    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <span className="w-8 text-sm text-gray-500">{rating}分</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full"
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
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">功能分类</h3>
                <div className="space-y-2">
                  {Object.entries(categoryStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-gray-600">{category}</span>
                        <span className="text-gray-500 text-sm">{count} 条</span>
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
