import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'
import { getSkillBySlug, skillCategoryLabel } from '@/modules/skill'
import { SkillCopyButton } from '@/components/skill-copy-button'
import { ReviewPanel } from '@/components/review-panel'

export const revalidate = 60

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: SkillDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const skill = await getSkillBySlug(slug)
  if (!skill) return { title: 'Not Found' }
  return buildMetadata({
    title: `${skill.title} - Skill`,
    description: skill.summary || skill.prompt.slice(0, 160),
    path: `/skills/${skill.slug}`,
  })
}

export default async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const { slug } = await params
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const skill = await getSkillBySlug(slug)
  if (!skill) notFound()

  const breadcrumbItems = [
    { name: '首页', path: '/' },
    { name: 'Skill 库', path: '/skills' },
    { name: skillCategoryLabel(skill.category), path: `/skills?category=${encodeURIComponent(skill.category)}` },
    { name: skill.title, path: `/skills/${skill.slug}` },
  ]

  return (
    <main className="min-h-screen bg-[var(--color-bg)] skill-chamber-bg relative">
      <JsonLd value={buildBreadcrumbList(breadcrumbItems)} />
      <SiteNav
        active="skills"
        actionLabel={isAdmin ? '编辑' : undefined}
        actionHref={isAdmin ? `/skills/manage?edit=${skill.id}` : undefined}
      />

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/skills" className="text-sm text-cyan-400 hover:text-cyan-300">← 回 Skill 库</Link>

        <header className="mt-6 mb-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <p className="skill-eyebrow">{skillCategoryLabel(skill.category)}</p>
            <span className="text-xs px-2 py-0.5 rounded border border-cyan-500/25 text-cyan-300">当前：Prompt 型 Skill</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold font-['Orbitron'] gradient-text mb-4">
            {skill.title}
          </h1>
          {skill.summary && (
            <p className="text-lg text-muted max-w-3xl">{skill.summary}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {skill.tags.map((tag) => (
              <span key={tag} className="skill-mini-tag">{tag}</span>
            ))}
          </div>
        </header>

        <section className="cyber-card rounded-2xl p-5 mb-8">
          <p className="text-xs tracking-[0.25em] text-cyan-300 uppercase mb-2">QUICK START · V1</p>
          <p className="text-muted">
            复制下方指令，在对应模型或工具中执行，并根据实际结果补充评测。后续版本会逐步加入输入契约、依赖、版本、失败边界和跨环境验证。
          </p>
        </section>

        <div className="skill-specimen-grid !mt-0">
          <section className="skill-prompt-slab !min-h-[320px]">
            <div className="skill-slab-label">
              <span>INSTRUCTIONS</span>
              <SkillCopyButton text={skill.prompt} />
            </div>
            <pre className="skill-prompt-body !max-h-none">{skill.prompt}</pre>
          </section>

          <section className="skill-effect-slab !min-h-[320px]">
            <div className="skill-slab-label">
              <span>EXAMPLE / EVIDENCE</span>
              <span className="opacity-50">效果 / 证据</span>
            </div>
            {skill.effectImageUrl ? (
              <div className="skill-effect-frame !min-h-[260px]">
                <Image
                  src={skill.effectImageUrl}
                  alt={skill.effectNote || skill.title}
                  fill
                  unoptimized
                  className="object-contain bg-black/40"
                />
              </div>
            ) : (
              <div className="skill-effect-empty !min-h-[260px]">尚无效果或证据</div>
            )}
            {skill.effectNote && <p className="skill-effect-note">{skill.effectNote}</p>}
          </section>
        </div>

        {skill.sourceUrl && (
          <p className="mt-8 text-sm text-soft">
            来源：{' '}
            <a href={skill.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
              {skill.sourceUrl}
            </a>
          </p>
        )}

        <ReviewPanel subjectType="skill" subjectId={skill.id} title="验证、评测或吐槽这份 Skill" />
      </article>

      <SiteFooter />
    </main>
  )
}
