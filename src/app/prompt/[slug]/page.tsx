import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { TargetReviewSection } from '@/components/target-review-section'

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

export default async function PromptDetailPage({ params }: TargetPageProps) {
  const { slug } = await params
  const session = await getServerSession(authOptions)
  const canPublishReview = Boolean(session?.user?.id)

  const target = await prisma.target.findFirst({
    where: { slug, type: 'prompt' as any },
    include: {
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
  }) as any

  if (!target) {
    notFound()
  }

  const features = parseFeatures(target.features)
  const ratings = target.reviews.map((r: any) => r.rating)
  const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null
  const totalReviews = target.reviews.length

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <SiteNav
        navItems={[
          {
            href: '/coding?category=prompt',
            label: 'AI Prompt',
            className: 'text-pink-300 font-medium tracking-wide',
          },
          {
            href: '/app',
            label: '应用工坊',
            className: 'text-cyan-400 hover:text-cyan-300 transition-colors font-medium tracking-wide',
          },
          {
            href: '/articles',
            label: '社区文章',
            className: 'text-pink-400 hover:text-pink-300 transition-colors font-medium tracking-wide',
          },
        ]}
        borderClassName="border-pink-500/20"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="cyber-card rounded-3xl p-8 mb-8" style={{ borderColor: 'rgba(236, 72, 153, 0.25)' }}>
          <div className="flex items-start gap-6">
            {target.logoUrl && (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 p-3 flex items-center justify-center">
                <Image src={target.logoUrl} alt={target.name} width={56} height={56} unoptimized className="w-14 h-14 rounded object-contain" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold font-['Orbitron'] text-white mb-2">{target.name}</h1>
              {target.developer && <p className="text-gray-500">作者/团队: {target.developer}</p>}
              {target.description && <p className="text-gray-400 mt-3">{target.description}</p>}
              {target.websiteUrl && <a href={target.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-pink-300 hover:text-pink-200 mt-2 inline-block transition-colors">打开原链接 →</a>}
            </div>
            <div className="text-right">
              {avgRating && <div className="text-4xl font-bold font-['Orbitron']"><span className="text-yellow-400">★</span> <span className="text-white">{avgRating.toFixed(1)}</span></div>}
              <div className="text-gray-500 mt-1">{totalReviews} 条评测</div>
            </div>
          </div>
          {features.length > 0 && (
            <div className="mt-6 pt-6 border-t border-pink-500/10">
              <div className="flex flex-wrap gap-2">
                {features.map((feature) => (
                  <span key={feature} className="px-3 py-1 bg-pink-500/10 text-pink-300 rounded-full text-sm">{feature}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 cyber-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold font-['Orbitron'] gradient-text">评测列表</h2>
            </div>
            <TargetReviewSection targetId={target.id} canPublishReview={canPublishReview} />
          </div>
          <div className="cyber-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold font-['Orbitron'] text-white mb-4">说明</h3>
            <p className="text-gray-500 text-sm">该目标的评测列表按时间和热度展示，不再使用分类标签。</p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
