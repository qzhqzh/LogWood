import type { Metadata } from 'next'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { TargetReviewSection } from '@/components/target-review-section'
import { JsonLd } from '@/components/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'
import {
  buildBreadcrumbList,
  buildMetadata,
  buildSoftwareApplicationJsonLd,
} from '@/shared/seo'

export const revalidate = 300

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const target = await prisma.target.findFirst({
    where: { slug: params.slug, type: 'model' },
    include: { _count: { select: { reviews: { where: { status: 'published' } } } } },
  })
  if (!target) return { title: 'Not Found' }
  const description = target.description
    ? target.description.slice(0, 160)
    : `${target.name} 模型资源的真实使用记录、能力边界与评测`
  return buildMetadata({
    title: `${target.name} - 模型资源`,
    description,
    path: `/model/${target.slug}`,
  })
}

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

export default async function ModelDetailPage({ params }: TargetPageProps) {
  const { slug } = await params
  const session = await getServerSession(authOptions)
  const canPublishReview = Boolean(session?.user?.id)

  const target = await prisma.target.findFirst({
    where: { slug, type: 'model' },
    include: {
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
  })

  if (!target) {
    notFound()
  }

  const features = parseFeatures(target.features)
  const ratings = target.reviews.map((r) => r.rating)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
  const totalReviews = target.reviews.length

  const path = `/model/${target.slug}`
  const jsonLd = buildSoftwareApplicationJsonLd({
    name: target.name,
    description: target.description ?? `${target.name} 模型资源`,
    url: path,
    applicationCategory: 'DeveloperApplication',
    sameAs: target.websiteUrl ?? null,
    reviewCount: totalReviews,
    ratingValue: avgRating,
  })

  const breadcrumbItems = [
    { name: '首页', path: '/' },
    { name: '资源收藏', path: '/tools' },
    { name: '模型', path: '/tools?category=model' },
    { name: target.name, path },
  ]
  const breadcrumbJsonLd = buildBreadcrumbList(breadcrumbItems)

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd value={jsonLd} />
      <JsonLd value={breadcrumbJsonLd} />
      <SiteNav
        active="inspiration"
        borderClassName="border-purple-500/20"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <Breadcrumbs
          items={breadcrumbItems.map((item, index) =>
            index === breadcrumbItems.length - 1
              ? { name: item.name }
              : { name: item.name, href: item.path },
          )}
          className="mb-6"
        />
        <div className="cyber-card rounded-3xl p-8 mb-8" style={{ borderColor: 'rgba(191, 0, 255, 0.2)' }}>
          <div className="flex items-start gap-6">
            {target.logoUrl && (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 p-3 flex items-center justify-center">
                <Image src={target.logoUrl} alt={target.name} width={56} height={56} unoptimized className="w-14 h-14 rounded object-contain" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-xs tracking-[0.2em] text-purple-300 uppercase mb-2">MODEL RESOURCE</p>
              <h1 className="text-3xl font-bold font-['Orbitron'] text-[var(--color-text-strong)] mb-2">{target.name}</h1>
              {target.developer && <p className="text-gray-500">开发者: {target.developer}</p>}
              {target.description && <p className="text-gray-400 mt-3">{target.description}</p>}
              {target.websiteUrl && <a href={target.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-purple-200 mt-2 inline-block transition-colors">访问官网 →</a>}
            </div>
            <div className="text-right">
              {avgRating && <div className="text-4xl font-bold font-['Orbitron']"><span className="text-yellow-400">★</span> <span className="text-[var(--color-text-strong)]">{avgRating.toFixed(1)}</span></div>}
              <div className="text-gray-500 mt-1">{totalReviews} 条真实记录</div>
            </div>
          </div>
          {features.length > 0 && (
            <div className="mt-6 pt-6 border-t border-purple-500/10">
              <div className="flex flex-wrap gap-2">
                {features.map((feature) => (
                  <span key={feature} className="px-3 py-1 bg-purple-500/10 text-purple-300 rounded-full text-sm">{feature}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 cyber-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold font-['Orbitron'] gradient-text">评测与使用记录</h2>
            </div>
            <TargetReviewSection targetId={target.id} canPublishReview={canPublishReview} />
          </div>
          <div className="cyber-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold font-['Orbitron'] text-[var(--color-text-strong)] mb-4">资源说明</h3>
            <p className="text-gray-500 text-sm">模型本身是被试用和评测的资源；从实践中提炼出的 Prompt、Workflow 或 Skill 将作为独立可复用资产保存。</p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
