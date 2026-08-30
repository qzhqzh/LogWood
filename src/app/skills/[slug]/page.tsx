import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { ArrowLeft, ArrowRight, GitCompareArrows } from 'lucide-react'
import { AiAttribution } from '@/components/ai-attribution'
import { EvaluationPanel } from '@/components/evaluation-panel'
import { JsonLd } from '@/components/json-ld'
import { LifecycleOriginHistory } from '@/components/lifecycle-origin-history'
import { PromptEffectStage } from '@/components/prompt-effect-stage'
import { ReviewPanel } from '@/components/review-panel'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { SkillCopyButton } from '@/components/skill-copy-button'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import {
  getPromptLibrarySkillBySlug,
  listPromptLibrary,
  skillCategoryLabel,
} from '@/modules/skill'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 60

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export async function generateMetadata({ params }: SkillDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const skill = await getPromptLibrarySkillBySlug(slug)
  if (!skill) return { title: '提示词不存在' }
  return buildMetadata({
    title: `${skill.title} - 提示词`,
    description: skill.summary || skill.prompt.slice(0, 160),
    path: `/skills/${skill.slug}`,
  })
}

export default async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const { slug } = await params
  const [session, skill] = await Promise.all([
    getServerSession(authOptions),
    getPromptLibrarySkillBySlug(slug),
  ])
  if (!skill) notFound()
  const isAdmin = isAdminSession(session)
  const peers = (await listPromptLibrary({ category: skill.category }))
    .filter((peer) => peer.id !== skill.id)
    .slice(0, 4)
  const comparisonHref = peers[0]
    ? `/compare/prompts?ids=${encodeURIComponent(skill.slug)},${encodeURIComponent(peers[0].slug)}`
    : `/skills?category=${encodeURIComponent(skill.category)}&compare=${encodeURIComponent(skill.slug)}#prompt-index`
  const breadcrumbItems = [
    { name: '首页', path: '/' },
    { name: '提示库', path: '/skills' },
    { name: skillCategoryLabel(skill.category), path: `/skills?category=${encodeURIComponent(skill.category)}` },
    { name: skill.title, path: `/skills/${skill.slug}` },
  ]

  return (
    <main className="ascii-app">
      <JsonLd value={buildBreadcrumbList(breadcrumbItems)} />
      <SiteNav
        active="skills"
        actionLabel={isAdmin ? 'Edit Prompt' : undefined}
        actionHref={isAdmin ? `/skills/manage?edit=${skill.id}` : undefined}
      />

      <article className="ascii-detail">
        <Link href="/skills" className="ascii-back-link"><ArrowLeft className="h-4 w-4" aria-hidden />返回提示库</Link>
        <header className="ascii-detail__header">
          <div>
            <p className="ascii-kicker">[:: {skillCategoryLabel(skill.category)} / EXECUTABLE PROMPT ::]</p>
            <h1>{skill.title}</h1>
            {skill.summary ? <p>{skill.summary}</p> : null}
          </div>
          <div className="ascii-detail__header-actions">
            <SkillCopyButton text={skill.prompt} />
            <Link href={comparisonHref} className="ascii-button">
              <GitCompareArrows className="h-4 w-4" aria-hidden />
              对比同类
            </Link>
          </div>
        </header>

        <div className="ascii-detail-grid">
          <section className="ascii-panel ascii-prompt-body" aria-labelledby="prompt-body-heading">
            <div className="ascii-panel__heading">
              <h2 id="prompt-body-heading">[:: 可执行正文 ::]</h2>
              <span>{skill.prompt.length} 字符</span>
            </div>
            <pre>{skill.prompt}</pre>
            {skill.tags.length > 0 ? (
              <div className="ascii-prompt-card__tags">
                {skill.tags.map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
            ) : null}
          </section>

          <section className="ascii-panel ascii-detail-stage" aria-labelledby="effect-heading">
            <div className="ascii-panel__heading">
              <h2 id="effect-heading">[:: 效果 / 证据 ::]</h2>
              <span>{skill.effectImageUrl ? '真实记录' : '待补充'}</span>
            </div>
            <PromptEffectStage
              title={skill.title}
              prompt={skill.prompt}
              effectImageUrl={skill.effectImageUrl}
              effectNote={skill.effectNote}
              priority
            />
          </section>

          <aside className="ascii-panel ascii-detail-inspector" aria-labelledby="inspector-heading">
            <div className="ascii-panel__heading">
              <h2 id="inspector-heading">[:: INSPECTOR ::]</h2>
              <span>只读</span>
            </div>
            <dl className="ascii-evidence-list">
              <div><dt>状态</dt><dd>已通过人工发布门禁</dd></div>
              <div><dt>正式验证</dt><dd>{skill._count.evaluations} 份已公开记录</dd></div>
              <div><dt>使用反馈</dt><dd>{skill._count.reviews} 条已公开记录</dd></div>
              <div><dt>最近更新</dt><dd><time dateTime={skill.updatedAt.toISOString()}>{dateFormatter.format(skill.updatedAt)}</time></dd></div>
              <div>
                <dt>外部来源</dt>
                <dd>{skill.sourceUrl ? <a href={skill.sourceUrl} target="_blank" rel="noopener noreferrer">打开来源 ↗</a> : '未记录'}</dd>
              </div>
            </dl>
            <AiAttribution
              provider={skill.aiProvider}
              model={skill.aiModel}
              modelVersion={skill.aiModelVersion}
              generatedAt={skill.aiGeneratedAt}
              className="ascii-attribution"
            />
          </aside>
        </div>

        {peers.length > 0 ? (
          <section className="ascii-related" aria-labelledby="related-heading">
            <div className="ascii-panel__heading">
              <h2 id="related-heading">[:: 同类提示词 ::]</h2>
              <Link href={`/skills?category=${encodeURIComponent(skill.category)}&compare=${encodeURIComponent(skill.slug)}`}>选择更多</Link>
            </div>
            <div>
              {peers.map((peer) => (
                <Link key={peer.id} href={`/skills/${peer.slug}`}>
                  <span><strong>{peer.title}</strong><small>{peer.summary || '查看正文和效果记录'}</small></span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="ascii-records">
          <LifecycleOriginHistory subjectType="skill" subjectId={skill.id} />
          <EvaluationPanel subjectType="skill" subjectId={skill.id} title="这条提示词的正式验证" />
          <ReviewPanel subjectType="skill" subjectId={skill.id} title="使用记录、问题与反馈" />
        </div>
      </article>

      <SiteFooter />
    </main>
  )
}
