import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { SITE_NAME, SITE_TAGLINE, buildMetadata, buildWebSite } from '@/shared/seo'
import { countPublishedSkills, listPublishedSkills, skillCategoryLabel } from '@/modules/skill'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const [skillCount, appCount] = await Promise.all([
    countPublishedSkills(),
    prisma.app.count({ where: { status: 'published' } }),
  ])
  return buildMetadata({
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: `已收藏 ${skillCount} 份 Skill 标本、${appCount} 件画廊作品。${SITE_TAGLINE}`,
    path: '/',
  })
}

export default async function HomePage() {
  const [featuredSkills, featuredApps, featuredArticles, skillCount, galleryCount, noteCount] = await Promise.all([
    listPublishedSkills().then((items) => items.slice(0, 6)),
    prisma.app.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        previewImageUrl: true,
      },
    }),
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
    countPublishedSkills(),
    prisma.app.count({ where: { status: 'published' } }),
    prisma.article.count({ where: { status: 'published' } }),
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

      <section className="relative pt-20 pb-28 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-500/5">
            <span className="text-cyan-400 text-sm tracking-widest">HOLLOW TREE · CURATION</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold font-['Orbitron'] mb-4 leading-tight">
            <span className="gradient-text">{SITE_NAME}</span>
          </h1>

          <p className="text-2xl md:text-3xl text-[var(--color-text-strong)] mb-6 font-light tracking-wide">
            {SITE_TAGLINE}
          </p>

          <p className="text-lg text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Skill 室收提示词与效果标本；画廊展美图与示例站；造物台帮你把灵感重新生长。
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link href="/skills" className="cyber-button px-8 py-3 rounded-lg font-semibold text-lg tracking-wide">
              进入 Skill 室
            </Link>
            <Link href="/app" className="px-8 py-3 rounded-lg font-semibold text-lg tracking-wide border border-[var(--color-success-border)] text-app hover:bg-[var(--color-success-bg)] transition-all">
              逛画廊
            </Link>
            <Link href="/forge" className="px-8 py-3 rounded-lg font-semibold text-lg tracking-wide border border-[var(--color-danger-border)] text-article hover:bg-[var(--color-danger-bg)] transition-all">
              打开造物台
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-coding mb-2">{skillCount}</div>
              <div className="text-muted text-sm tracking-wide">Skill 标本</div>
            </div>
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-app mb-2">{galleryCount}</div>
              <div className="text-muted text-sm tracking-wide">画廊</div>
            </div>
            <div className="cyber-card rounded-xl p-6 text-center">
              <div className="text-4xl font-bold font-['Orbitron'] text-article mb-2">{noteCount}</div>
              <div className="text-muted text-sm tracking-wide">洞笔记</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">Skill 标本</h2>
              <p className="text-soft">提示词 × 效果，按分类归档</p>
            </div>
            <Link href="/skills" className="text-coding hover-text-coding transition-colors flex items-center gap-2">
              进入 Skill 室 <span>→</span>
            </Link>
          </div>

          {featuredSkills.length === 0 ? (
            <div className="cyber-card rounded-2xl p-10 text-center text-soft">
              Skill 室还空着。管理员可前往{' '}
              <Link href="/skills/manage" className="text-cyan-400">/skills/manage</Link> 录入第一份标本。
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
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">画廊展陈</h2>
              <p className="text-soft">美图、创意与示例站——看见才会想生长</p>
            </div>
            <Link href="/app" className="text-app hover-text-app transition-colors flex items-center gap-2">
              查看全部 <span>→</span>
            </Link>
          </div>

          {featuredApps.length === 0 ? (
            <div className="cyber-card rounded-2xl p-8 text-center text-soft">画廊还空着，先放一件你想留下的作品</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {featuredApps.map((app) => (
                <Link
                  key={app.id}
                  href={`/app/${app.slug}`}
                  className="cyber-card rounded-2xl overflow-hidden group transition-all duration-300 hover:scale-105"
                >
                  {app.previewImageUrl ? (
                    <div className="relative h-40 bg-gradient-to-br from-cyan-500/10 to-purple-500/10">
                      <Image src={app.previewImageUrl} alt={app.title} fill className="object-cover" />
                    </div>
                  ) : null}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-[var(--color-text-strong)] group-hover:text-purple-300 transition-colors mb-3 line-clamp-2">
                      {app.title}
                    </h3>
                    <p className="text-muted text-sm line-clamp-3">{app.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 px-4 border-t border-divider">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-2">洞笔记</h2>
              <p className="text-soft">长一点的思考与生长记录</p>
            </div>
            <Link href="/articles" className="text-article hover-text-article transition-colors flex items-center gap-2">
              查看全部 <span>→</span>
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
          <h2 className="text-2xl font-bold font-['Orbitron'] gradient-text mb-3">造物台</h2>
          <p className="text-muted mb-6">把一句灵感长成可落地的草稿——提示词、结构、下一步。</p>
          <Link href="/forge" className="cyber-button px-8 py-3 rounded-lg inline-block font-semibold">
            打开造物台
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
