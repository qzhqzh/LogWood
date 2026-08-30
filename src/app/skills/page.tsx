import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { TargetType } from '@prisma/client'
import { ArrowRight, Search } from 'lucide-react'
import { JsonLd } from '@/components/json-ld'
import { PromptComparePicker } from '@/components/prompt-compare-picker'
import { PromptGlitchTitle } from '@/components/prompt-glitch-title'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { SKILL_CATEGORY_ORDER, listPromptLibrary, skillCategoryLabel } from '@/modules/skill'
import { listTargets } from '@/modules/target'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: 'Prompt',
  description: '按用途浏览可执行提示词，查看真实效果、来源、归属和验证记录，并选择同类提示词并排比较。',
  path: '/skills',
})

interface SkillsPageProps {
  searchParams?: { category?: string; q?: string; compare?: string }
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const [session, allPrompts, legacyPrompts] = await Promise.all([
    getServerSession(authOptions),
    listPromptLibrary(),
    listTargets({ type: TargetType.prompt }),
  ])
  const isAdmin = isAdminSession(session)
  const category = searchParams?.category?.trim() || ''
  const search = searchParams?.q?.trim() || ''
  const needle = search.toLocaleLowerCase('zh-CN')
  const visiblePrompts = allPrompts.filter((prompt) => {
    if (category && prompt.category !== category) return false
    if (!needle) return true
    return [prompt.title, prompt.summary || '', prompt.prompt, ...prompt.tags]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(needle))
  })
  const categoryCounts = new Map<string, number>()
  allPrompts.forEach((prompt) => categoryCounts.set(prompt.category, (categoryCounts.get(prompt.category) || 0) + 1))
  const categories = [
    ...SKILL_CATEGORY_ORDER.filter((key) => categoryCounts.has(key)),
    ...Array.from(categoryCounts.keys()).filter((key) => !SKILL_CATEGORY_ORDER.includes(key as never)).sort(),
  ]
  const initialCompare = searchParams?.compare ? [searchParams.compare] : []

  return (
    <main className="ascii-app">
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: 'Prompt', path: '/skills' },
      ])} />
      <SiteNav
        active="skills"
        actionLabel={isAdmin ? 'Manage Prompts' : undefined}
        actionHref={isAdmin ? '/skills/manage' : undefined}
      />

      <header className="ascii-page-header ascii-page-header--prompt">
        <div>
          <PromptGlitchTitle />
          <p>WRITE. RUN. VERIFY.</p>
        </div>
        <dl className="prompt-status-register" aria-label="Prompt 库状态">
          <div><dt>PUBLISHED</dt><dd>{String(allPrompts.length).padStart(2, '0')}</dd></div>
          <div><dt>WITH_EFFECT</dt><dd>{String(allPrompts.filter((prompt) => prompt.effectImageUrl).length).padStart(2, '0')}</dd></div>
          <div><dt>VISIBLE_NOW</dt><dd>{String(visiblePrompts.length).padStart(2, '0')}</dd></div>
        </dl>
      </header>

      <section className="ascii-filter-bar" aria-label="筛选提示词">
        <nav aria-label="提示词分类">
          <Link href={search ? `/skills?q=${encodeURIComponent(search)}` : '/skills'} className={!category ? 'is-active' : ''}>全部 · {allPrompts.length}</Link>
          {categories.map((key) => (
            <Link
              key={key}
              href={`/skills?category=${encodeURIComponent(key)}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className={category === key ? 'is-active' : ''}
            >
              {skillCategoryLabel(key)} · {categoryCounts.get(key)}
            </Link>
          ))}
        </nav>
        <form action="/skills" role="search">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <Search className="h-4 w-4" aria-hidden />
          <label className="sr-only" htmlFor="prompt-search">搜索提示词</label>
          <input id="prompt-search" type="search" name="q" defaultValue={search} placeholder="搜索标题、正文或标签" />
          <button type="submit">搜索</button>
        </form>
      </section>

      <section id="prompt-index" className="ascii-library-grid" aria-label="提示词列表">
        {visiblePrompts.map((prompt, index) => (
          <article key={prompt.id} className="ascii-prompt-card">
            <Link href={`/skills/${prompt.slug}`} className="ascii-prompt-card__preview">
              {prompt.effectImageUrl ? (
                <Image
                  src={prompt.effectImageUrl}
                  alt={prompt.effectNote || `${prompt.title} 的效果预览`}
                  width={880}
                  height={520}
                  unoptimized
                  sizes="(max-width: 768px) 92vw, (max-width: 1200px) 44vw, 30vw"
                />
              ) : (
                <span className="ascii-prompt-card__fallback">
                  <span aria-hidden="true">TEXT_OUTPUT::{String(index + 1).padStart(2, '0')} / NO_EFFECT</span>
                  <span>{prompt.prompt}</span>
                </span>
              )}
            </Link>
            <div className="ascii-prompt-card__body">
              <div className="ascii-prompt-card__meta">
                <span>{String(index + 1).padStart(2, '0')} / {skillCategoryLabel(prompt.category)}</span>
                <span>{prompt._count.evaluations} 验证 · {prompt._count.reviews} 反馈</span>
              </div>
              <h2><Link href={`/skills/${prompt.slug}`}>{prompt.title}</Link></h2>
              <p>{prompt.summary || '打开查看完整提示词、效果和证据。'}</p>
              <div className="ascii-prompt-card__tags">
                {prompt.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
              <Link href={`/skills/${prompt.slug}`} className="ascii-text-link">
                查看完整记录 <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </article>
        ))}
        {visiblePrompts.length === 0 ? (
          <div className="ascii-panel ascii-empty-state">
            <p aria-hidden="true">[ ·· :: ···· :: ·· ]</p>
            <h2>没有匹配的公开提示词</h2>
            <p>试试其他关键词或清除分类；草稿不会被搜索到。</p>
            <Link href="/skills" className="ascii-button">清除筛选</Link>
          </div>
        ) : null}
      </section>

      {visiblePrompts.length > 0 ? (
        <PromptComparePicker
          prompts={visiblePrompts.map((prompt) => ({
            slug: prompt.slug,
            title: prompt.title,
            categoryLabel: skillCategoryLabel(prompt.category),
            hasEffect: Boolean(prompt.effectImageUrl),
          }))}
          initialSlugs={initialCompare}
        />
      ) : null}

      {legacyPrompts.length > 0 ? (
        <details className="ascii-legacy-panel">
          <summary>历史提示资源兼容区 · {legacyPrompts.length}</summary>
          <p>这些是旧 Target 模型中的提示资源，仅保留历史访问；新内容统一进入上方 Prompt Skill。</p>
          <div>
            {legacyPrompts.map((prompt) => (
              <Link key={prompt.id} href={`/prompt/${prompt.slug}`}>{prompt.name} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            ))}
          </div>
        </details>
      ) : null}

      <SiteFooter />
    </main>
  )
}
