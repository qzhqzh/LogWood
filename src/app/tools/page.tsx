import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { TargetType } from '@prisma/client'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import {
  SKILL_CATEGORIES,
  skillCategoryLabel,
  skillDetailPath,
} from '@/shared/skills/taxonomy'

export const revalidate = 300

export const metadata: Metadata = buildMetadata({
  title: '工具收藏',
  description: '历史 AI 工具与评测收藏——创作器、编码助手、模型与流程',
  path: '/tools',
})

function toolsListPath(category?: string) {
  if (!category) return '/tools'
  return `/tools?category=${category}`
}

function parseFeatures(features: string): string[] {
  try {
    return JSON.parse(features)
  } catch {
    return []
  }
}

interface SkillsPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { category } = await searchParams
  const targets = await prisma.target.findMany({
    where: {
      type: { in: ['editor', 'coding', 'model', 'prompt'] },
    },
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

  const selectedCategory = SKILL_CATEGORIES.some((item) => item.key === category)
    ? category as TargetType
    : 'coding'

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

  const groupedTargets = SKILL_CATEGORIES.map((item) => ({
    ...item,
    targets: targetsWithStats.filter((target) => target.type === item.key),
  }))

  const activeGroup = groupedTargets.find((item) => item.key === selectedCategory) || groupedTargets[1]

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '工具收藏', path: '/tools' },
        ])}
      />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav
        active="coding"
        actionLabel={isAdmin ? '工具管理' : undefined}
        actionHref={isAdmin ? `/targets/manage/${selectedCategory}` : undefined}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="mb-12">
          <div className="inline-block mb-4 px-4 py-1 border border-purple-500/30 rounded-full bg-purple-500/5">
            <span className="text-purple-400 text-sm tracking-widest uppercase">TOOL SHELF</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] mb-4">
            <span className="gradient-text">工具收藏</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            历史 AI 工具与评测仍保留在这里。真正的提示词 × 效果标本请去{' '}
            <Link href="/skills" className="text-cyan-400 hover:text-cyan-300">Skill 室</Link>。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          {groupedTargets.map((group) => (
            <Link
              key={group.key}
              href={toolsListPath(group.key)}
              className={`px-4 py-2 rounded-full border text-sm tracking-wide transition-colors ${
                selectedCategory === group.key
                  ? 'border-purple-400 bg-purple-500/10 text-purple-300'
                  : 'border-white/10 text-gray-400 hover:border-purple-500/40 hover:text-[var(--color-text-strong)]'
              }`}
            >
              {group.label} · {group.targets.length}
            </Link>
          ))}
        </div>

        <div className="mb-8 cyber-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs tracking-[0.3em] text-purple-300 uppercase mb-2">当前分类</p>
              <h2 className="text-2xl font-bold text-[var(--color-text-strong)]">{activeGroup.label}</h2>
              <p className="text-gray-500 mt-2">{activeGroup.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-['Orbitron'] text-purple-300">{activeGroup.targets.length}</div>
              <div className="text-gray-500 text-sm">本类条目</div>
            </div>
          </div>
        </div>

        {activeGroup.targets.length === 0 ? (
          <div className="cyber-card rounded-2xl p-12 text-center">
            <p className="text-gray-400 mb-5">{activeGroup.emptyText}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeGroup.targets.map((target, index) => (
              <div
                key={target.id}
                className="cyber-card rounded-2xl overflow-hidden group transition-all duration-300 hover:scale-105"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <Link href={skillDetailPath(target.type, target.slug)} className="block">
                  {target.previewImageUrl ? (
                    <div className="relative h-36 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                      <Image
                        src={target.previewImageUrl}
                        alt={target.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="p-6 pb-2">
                    <div className="flex items-start gap-4 mb-4">
                      {target.logoUrl && (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-2 flex items-center justify-center">
                          <Image
                            src={target.logoUrl}
                            alt={target.name}
                            width={40}
                            height={40}
                            unoptimized
                            className="w-10 h-10 rounded object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-[var(--color-text-strong)] group-hover:text-purple-400 transition-colors">
                          {target.name}
                        </h2>
                        <span className="inline-flex mt-2 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-xs tracking-wide">
                          {activeGroup.badge}
                        </span>
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
                      <div className="flex flex-wrap gap-2 mb-2">
                        {target.features.map((feature) => (
                          <span
                            key={feature}
                            className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="px-6 pb-5 flex items-center justify-between gap-3 border-t border-purple-500/10">
                  <Link
                    href={skillDetailPath(target.type, target.slug)}
                    className="text-purple-400 text-sm hover:text-purple-300 py-3"
                  >
                    查看详情 →
                  </Link>
                  {target.compareGroup ? (
                    <Link
                      href={`/compare?group=${encodeURIComponent(target.compareGroup)}`}
                      className="text-xs text-cyan-300 hover:text-cyan-200 py-3"
                    >
                      同组对比
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  )
}
