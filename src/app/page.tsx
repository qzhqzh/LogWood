import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { SITE_NAME, SITE_TAGLINE, buildMetadata, buildWebSite } from '@/shared/seo'
import { countPublishedSkills, listPublishedSkills, skillCategoryLabel } from '@/modules/skill'
import { listCandidates } from '@/modules/candidate'
import { getReviewSubjectPresentation } from '@/shared/reviews/subject'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const [skillCount, inspirationCount, reviewCount] = await Promise.all([
    countPublishedSkills(),
    prisma.candidate.count({ where: { status: { in: ['watching', 'evaluating'] } } }),
    prisma.review.count({ where: { status: 'published' } }),
  ])

  return buildMetadata({
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: `${skillCount} 份可复用 Skill、${inspirationCount} 条正在淘洗的灵感、${reviewCount} 条真实使用记录。${SITE_TAGLINE}。`,
    path: '/',
  })
}

export default async function HomePage() {
  const [
    featuredSkills,
    featuredCandidates,
    featuredArticles,
    latestReviews,
    skillCount,
    inspirationCount,
    recordCount,
  ] = await Promise.all([
    listPublishedSkills().then((items) => items.slice(0, 6)),
    listCandidates().then((items) => items.slice(0, 4)),
    prisma.article.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
      },
    }),
    prisma.review.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: {
        user: { select: { name: true } },
        anonymousUser: { select: { displayName: true } },
        target: { select: { name: true, slug: true, type: true } },
        skill: { select: { title: true, slug: true } },
        app: { select: { title: true, slug: true } },
        candidate: { select: { title: true, slug: true } },
        _count: {
          select: {
            comments: { where: { status: 'published' } },
          },
        },
      },
    }),
    countPublishedSkills(),
    prisma.candidate.count({ where: { status: { in: ['watching', 'evaluating'] } } }),
    prisma.review.count({ where: { status: 'published' } }),
  ])

  const websiteJsonLd = buildWebSite()

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative overflow-hidden">
      <JsonLd value={websiteJsonLd} />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav />

      <section className="relative pt-20 pb-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-500/5">
            <span className="text-cyan-400 text-sm tracking-widest">INSPIRATION → EVIDENCE → SKILL</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold font-['Orbitron'] mb-4 leading-tight">
            <span className="gradient-text">{SITE_NAME}</span>
          </h1>

          <p className="text-2xl md:text-3xl text-[var(--color-text-strong)] mb-6 font-light tracking-wide">
            {SITE_TAGLINE}
          </p>

          <p className="text-lg text-muted max-w-3xl mx-auto mb-5 leading-relaxed">
            从一个念头、一条链接或一次踩坑出发，经过试用、评测与反复打磨，把值得留下的经验炼成可复用的模板、提示词、工作流和技能包。
          </p>
          <p className="text-sm text-soft max-w-3xl mx-auto mb-10 leading-relaxed">
            同时保留途中真实的吐槽、失败、讨论、技术小结与认知变化，让结果和过程彼此反哺。
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link href="/candidates" className="cyber-button px-8 py-3 rounded-lg font-semibold text-lg tracking-wide">
              去找灵感
            </Link>
            <Link href="/skills" className="px-8 py-3 rounded-lg font-semibold text-lg tracking-wide border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 transition-all">
              浏览 Skill
            </Link>
            <Link href="/talk" className="px-8 py-3 rounded-lg font-semibold text-lg tracking-wide border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all">
              进入吐槽室
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-coding mb-2">{skillCount}</div>
              <div className="text-muted text-sm tracking-wide">可复用 Skill</div>
            </div>
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-amber-300 mb-2">{inspirationCount}</div>
              <div className="text-muted text-sm tracking-wide">正在淘洗的灵感</div>
            </div>
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-app mb-2">{recordCount}</div>
              <div className="text-muted text-sm tracking-wide">真实使用记录</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10 gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] text-cyan-300 uppercase mb-2">ASSET LINE</p>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">最近炼成的 Skill</h2>
              <p className="text-soft">已经整理成可直接复用、可以继续验证的能力资产</p>
            </div>
            <Link href="/skills" className="text-coding hover-text-coding transition-colors flex items-center gap-2 whitespace-nowrap">
              浏览 Skill 库 <span>→</span>
            </Link>
          </div>

          {featuredSkills.length === 0 ? (
            <div className="cyber-card rounded-2xl p-10 text-center text-soft">
              Skill 库还空着。先从一条真实验证过的经验开始整理。
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredSkills.map((skill) => (
                <Link
                  key={skill.id}
                  href={`/skills/${skill.slug}`}
                  className="cyber-card rounded-2xl overflow-hidden group hover:scale-[1.02] transition-transform"
                >
                  {skill.effectImageUrl ? (
                    <div className="relative h-36 bg-gradient-to-br from-cyan-500/10 to-purple-500/10">
                      <Image src={skill.effectImageUrl} alt={skill.title} fill unoptimized className="object-cover" />
                    </div>
                  ) : null}
                  <div className="p-5">
                    <span className="text-xs text-purple-300">{skillCategoryLabel(skill.category)}</span>
                    <h3 className="mt-1 text-lg font-semibold text-[var(--color-text-strong)] group-hover:text-cyan-300">
                      {skill.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted line-clamp-2 font-mono">
                      {skill.prompt.slice(0, 120)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 px-4 border-t border-divider">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10 gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] text-amber-300 uppercase mb-2">INSPIRATION LINE</p>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">正在淘洗的灵感</h2>
              <p className="text-soft">先观察，再试用；值得留下的经验继续炼成 Skill</p>
            </div>
            <Link href="/candidates" className="text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap">
              查看灵感池 →
            </Link>
          </div>

          {featuredCandidates.length === 0 ? (
            <div className="cyber-card rounded-2xl p-8 text-center text-soft">灵感池还空着，先投下一条链接或想法。</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {featuredCandidates.map((item) => (
                <Link
                  key={item.id}
                  href={`/candidates/${item.slug}`}
                  className="cyber-card rounded-2xl p-5 group hover:scale-[1.01] transition-transform"
                >
                  <div className="flex gap-4">
                    {item.previewImageUrl || item.logoUrl ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-black/30">
                        <Image
                          src={item.previewImageUrl || item.logoUrl || ''}
                          alt={item.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl shrink-0 bg-gradient-to-br from-amber-500/20 to-cyan-500/10 flex items-center justify-center text-amber-200 font-['Orbitron']">
                        {item.title.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-[var(--color-text-strong)] group-hover:text-amber-200 line-clamp-1">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted line-clamp-2">{item.summary || '等待补充为什么值得观察。'}</p>
                      <p className="mt-3 text-xs text-soft">{item.reviewCount} 条真实记录</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 px-4 border-t border-divider">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10 gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] text-purple-300 uppercase mb-2">JOURNEY LINE</p>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">最近的真实记录</h2>
              <p className="text-soft">吐槽、试用、失败和阶段性判断，都是炼成过程的一部分</p>
            </div>
            <Link href="/talk" className="text-app hover-text-app transition-colors whitespace-nowrap">
              进入吐槽室 →
            </Link>
          </div>

          {latestReviews.length === 0 ? (
            <div className="cyber-card rounded-2xl p-8 text-center text-soft">还没有真实使用记录。</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {latestReviews.map((review) => {
                const subject = getReviewSubjectPresentation(review)
                const authorName = review.user?.name || review.anonymousUser?.displayName || '匿名用户'

                return (
                  <article key={review.id} className="cyber-card rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        {subject ? (
                          <Link href={subject.href} className="font-semibold text-coding hover:text-cyan-200">
                            {subject.title}
                          </Link>
                        ) : (
                          <span className="font-semibold text-muted">历史内容</span>
                        )}
                        <p className="text-xs text-soft mt-1">
                          {authorName} · {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: zhCN })}
                        </p>
                      </div>
                      <span className="text-yellow-400 text-sm">★ {review.rating}</span>
                    </div>
                    <p className="text-muted line-clamp-4 whitespace-pre-wrap">{review.content}</p>
                    <div className="mt-4 pt-3 border-t border-divider flex items-center gap-4 text-xs text-soft">
                      <span>👍 {review.likesCount}</span>
                      <span>回复 {review._count.comments}</span>
                      {subject && <span className="ml-auto">{subject.kind}</span>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 px-4 border-t border-divider">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10 gap-4">
            <div>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">洞笔记</h2>
              <p className="text-soft">稍微沉底之后的技术小结、评测报告、前沿观点与复盘反思</p>
            </div>
            <Link href="/articles" className="text-article hover-text-article transition-colors whitespace-nowrap">
              查看全部 →
            </Link>
          </div>

          {featuredArticles.length === 0 ? (
            <div className="cyber-card rounded-2xl p-8 text-center text-soft">还没有洞笔记</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="cyber-card rounded-2xl p-5 group transition-all duration-300 hover:scale-105"
                >
                  <h3 className="text-lg font-semibold text-[var(--color-text-strong)] group-hover:text-pink-300 transition-colors mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-muted text-sm line-clamp-3">{article.excerpt || '暂无摘要'}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 border-t border-divider">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] text-pink-300 uppercase mb-2">LOCAL TEMPLATE · BETA</p>
          <h2 className="text-2xl font-bold font-['Orbitron'] gradient-text mb-3">AI 炼成助手</h2>
          <p className="text-muted mb-6">
            先用本地模板把一句灵感整理成 Skill 或洞笔记草稿；真实模型接入后，再扩展评测设计、版本比较和证据整理。
          </p>
          <Link href="/forge" className="cyber-button px-8 py-3 rounded-lg inline-block font-semibold">
            打开 Beta
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
