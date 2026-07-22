import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { SkillCopyButton } from '@/components/skill-copy-button'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { listSkillsGrouped, skillCategoryLabel } from '@/modules/skill'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: 'Skill 库',
  description: '浏览经过整理、可直接复用并继续验证的 Prompt、模板、工作流与 Skill。当前版本以提示词和效果标本为主。',
  path: '/skills',
})

interface SkillsPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function SkillsGalleryPage({ searchParams }: SkillsPageProps) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { category } = await searchParams
  const groups = await listSkillsGrouped(category)
  const total = groups.reduce((sum, g) => sum + g.skills.length, 0)

  return (
    <main className="min-h-screen bg-[var(--color-bg)] skill-chamber-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: 'Skill 库', path: '/skills' },
        ])}
      />

      <SiteNav
        active="skills"
        actionLabel={isAdmin ? '管理 Skill' : undefined}
        actionHref={isAdmin ? '/skills/manage' : undefined}
      />

      <header className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <p className="skill-eyebrow mb-4">REUSABLE ASSETS · PROMPT × EFFECT</p>
        <h1 className="text-4xl md:text-6xl font-bold font-['Orbitron'] gradient-text mb-4 leading-tight">
          Skill 库
        </h1>
        <p className="text-lg text-muted max-w-3xl leading-relaxed">
          这里陈列已经被整理、可以直接复用并继续验证的能力资产。当前条目以
          <strong className="text-[var(--color-text-strong)] font-medium"> Prompt × Effect </strong>
          为主；后续逐步补齐目标、输入、依赖、Quick Start、版本、失败边界与验证记录。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-soft">
          <span className="px-3 py-1 rounded-full border border-cyan-500/25 bg-cyan-500/5 text-cyan-300">
            {total} 份可复用资产
          </span>
          <span className="px-3 py-1 rounded-full border border-purple-500/25 bg-purple-500/5 text-purple-300">
            {groups.length} 个分类
          </span>
          <Link href="/candidates" className="text-muted hover:text-amber-200 transition-colors ml-auto">
            从灵感池开始淘洗 →
          </Link>
        </div>

        {groups.length > 1 && (
          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              href="/skills"
              className={`skill-chip ${!category ? 'skill-chip-active' : ''}`}
            >
              全部
            </Link>
            {groups.map((group) => (
              <Link
                key={group.category}
                href={`/skills?category=${encodeURIComponent(group.category)}`}
                className={`skill-chip ${category === group.category ? 'skill-chip-active' : ''}`}
              >
                {group.label}
                <span className="opacity-60 ml-1">{group.skills.length}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-16">
        {groups.length === 0 ? (
          <section className="skill-empty cyber-card rounded-2xl p-12 text-center">
            <p className="text-2xl font-['Orbitron'] text-[var(--color-text-strong)] mb-3">Skill 库还空着</p>
            <p className="text-muted mb-8">把一条已验证的提示、模板或工作流整理成第一份可复用资产。</p>
            {isAdmin && (
              <Link href="/skills/manage" className="cyber-button px-6 py-3 rounded-lg inline-block">
                录入第一份 Skill
              </Link>
            )}
          </section>
        ) : (
          groups.map((group) => (
            <section key={group.category} className="skill-shelf">
              <div className="skill-shelf-rail">
                <span className="skill-shelf-mark" aria-hidden />
                <div>
                  <p className="text-xs tracking-[0.35em] text-cyan-400/80 uppercase mb-1">SHELF</p>
                  <h2 className="text-2xl md:text-3xl font-['Orbitron'] text-[var(--color-text-strong)]">
                    {group.label}
                  </h2>
                </div>
                <span className="ml-auto text-soft text-sm tabular-nums">{group.skills.length}</span>
              </div>

              <div className="mt-6 space-y-6">
                {group.skills.map((skill) => (
                  <article key={skill.id} className="skill-specimen group">
                    <div className="skill-specimen-meta">
                      <h3 className="skill-specimen-title">
                        <Link href={`/skills/${skill.slug}`}>{skill.title}</Link>
                      </h3>
                      {skill.summary && (
                        <p className="text-sm text-muted mt-1 line-clamp-2">{skill.summary}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="skill-mini-tag">{skillCategoryLabel(skill.category)}</span>
                        {skill.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="skill-mini-tag skill-mini-tag-muted">{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="skill-specimen-grid">
                      <div className="skill-prompt-slab">
                        <div className="skill-slab-label">
                          <span>INSTRUCTIONS</span>
                          <SkillCopyButton text={skill.prompt} />
                        </div>
                        <pre className="skill-prompt-body">{skill.prompt}</pre>
                      </div>

                      <div className="skill-effect-slab">
                        <div className="skill-slab-label">
                          <span>EXAMPLE</span>
                          <span className="opacity-50">效果 / 证据</span>
                        </div>
                        {skill.effectImageUrl ? (
                          <div className="skill-effect-frame">
                            <Image
                              src={skill.effectImageUrl}
                              alt={skill.effectNote || skill.title}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="skill-effect-empty">尚无效果或证据</div>
                        )}
                        {skill.effectNote && (
                          <p className="skill-effect-note">{skill.effectNote}</p>
                        )}
                      </div>
                    </div>

                    <div className="skill-specimen-foot">
                      <Link href={`/skills/${skill.slug}`} className="text-cyan-300 text-sm hover:text-cyan-200">
                        打开 Skill →
                      </Link>
                      {skill.sourceUrl && (
                        <a
                          href={skill.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-soft text-xs hover:text-muted"
                        >
                          来源 ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <SiteFooter />
    </main>
  )
}
