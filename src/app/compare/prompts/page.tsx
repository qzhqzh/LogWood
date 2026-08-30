import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { GitCompareArrows } from 'lucide-react'
import { AiAttribution } from '@/components/ai-attribution'
import { JsonLd } from '@/components/json-ld'
import { PromptComparePicker } from '@/components/prompt-compare-picker'
import { PromptEffectStage } from '@/components/prompt-effect-stage'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { SkillCopyButton } from '@/components/skill-copy-button'
import { listPromptLibrary, skillCategoryLabel } from '@/modules/skill'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 60

export const metadata: Metadata = buildMetadata({
  title: '提示词对比',
  description: '并排比较 2–3 条公开提示词的真实效果、可执行正文、来源、AI 归属和验证记录。',
  path: '/compare/prompts',
})

interface PromptComparePageProps {
  searchParams?: { ids?: string }
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function parseSlugs(value?: string): string[] {
  if (!value) return []
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean))).slice(0, 3)
}

export default async function PromptComparePage({ searchParams }: PromptComparePageProps) {
  const requestedSlugs = parseSlugs(searchParams?.ids)
  const [selectedResult, allPrompts] = await Promise.all([
    requestedSlugs.length > 0 ? listPromptLibrary({ slugs: requestedSlugs }) : Promise.resolve([]),
    listPromptLibrary(),
  ])
  const promptBySlug = new Map(selectedResult.map((prompt) => [prompt.slug, prompt]))
  const prompts = requestedSlugs.map((slug) => promptBySlug.get(slug)).filter((prompt) => prompt !== undefined)
  const gridStyle = { '--compare-columns': prompts.length } as CSSProperties

  return (
    <main className="ascii-app">
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: '提示库', path: '/skills' },
        { name: '提示词对比', path: '/compare/prompts' },
      ])} />
      <SiteNav active="skills" />

      <header className="ascii-page-header ascii-compare-header">
        <div>
          <p className="ascii-kicker">[:: SIDE-BY-SIDE / 2–3 PROMPTS ::]</p>
          <h1>提示词对比</h1>
          <p>同一屏查看真实效果、完整指令和证据。这里不生成综合分数，也不替你宣布“最佳”。</p>
        </div>
        <GitCompareArrows className="ascii-page-header__icon" aria-hidden />
      </header>

      {prompts.length < 2 ? (
        <div className="ascii-compare-select">
          {requestedSlugs.length > 0 ? (
            <p className="ascii-notice" role="status">只找到 {prompts.length} 条可公开访问的提示词；草稿或不存在的记录不会进入对比。</p>
          ) : null}
          <PromptComparePicker
            prompts={allPrompts.map((prompt) => ({
              slug: prompt.slug,
              title: prompt.title,
              categoryLabel: skillCategoryLabel(prompt.category),
              hasEffect: Boolean(prompt.effectImageUrl),
            }))}
            initialSlugs={requestedSlugs}
          />
        </div>
      ) : (
        <>
          <div className="ascii-compare-toolbar">
            <p aria-live="polite">正在对比 {prompts.length} 条公开提示词</p>
            <Link href={`/skills?compare=${encodeURIComponent(prompts[0].slug)}#prompt-index`} className="ascii-button">重新选择</Link>
          </div>

          <section className="ascii-compare-scroll" aria-label="提示词并排对比">
            <div className="ascii-compare-table" style={gridStyle}>
              <div className="ascii-compare-row">
                <div className="ascii-compare-label">提示词</div>
                {prompts.map((prompt, index) => (
                  <div key={prompt.id} className="ascii-compare-title">
                    <span>{String(index + 1).padStart(2, '0')} / {skillCategoryLabel(prompt.category)}</span>
                    <h2><Link href={`/skills/${prompt.slug}`}>{prompt.title}</Link></h2>
                    <SkillCopyButton text={prompt.prompt} />
                  </div>
                ))}
              </div>

              <div className="ascii-compare-row">
                <div className="ascii-compare-label">效果预览</div>
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="ascii-compare-preview">
                    <PromptEffectStage
                      title={prompt.title}
                      prompt={prompt.prompt}
                      effectImageUrl={prompt.effectImageUrl}
                      effectNote={prompt.effectNote}
                      compact
                    />
                  </div>
                ))}
              </div>

              <div className="ascii-compare-row">
                <div className="ascii-compare-label">说明</div>
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="ascii-compare-cell">{prompt.summary || '未单独记录说明。'}</div>
                ))}
              </div>

              <div className="ascii-compare-row">
                <div className="ascii-compare-label">完整指令</div>
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="ascii-compare-prompt"><pre>{prompt.prompt}</pre></div>
                ))}
              </div>

              <div className="ascii-compare-row">
                <div className="ascii-compare-label">验证记录</div>
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="ascii-compare-cell">
                    {prompt._count.evaluations} 份正式验证<br />
                    {prompt._count.reviews} 条使用反馈
                  </div>
                ))}
              </div>

              <div className="ascii-compare-row">
                <div className="ascii-compare-label">来源与更新</div>
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="ascii-compare-cell">
                    <time dateTime={prompt.updatedAt.toISOString()}>更新于 {dateFormatter.format(prompt.updatedAt)}</time><br />
                    {prompt.sourceUrl ? <a href={prompt.sourceUrl} target="_blank" rel="noopener noreferrer">打开来源 ↗</a> : '未记录外部来源'}
                  </div>
                ))}
              </div>

              <div className="ascii-compare-row">
                <div className="ascii-compare-label">AI 归属</div>
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="ascii-compare-cell">
                    <AiAttribution
                      provider={prompt.aiProvider}
                      model={prompt.aiModel}
                      modelVersion={prompt.aiModelVersion}
                      generatedAt={prompt.aiGeneratedAt}
                    />
                    {!prompt.aiProvider && !prompt.aiModel && !prompt.aiModelVersion && !prompt.aiGeneratedAt
                      ? '未标记为 AI 生成'
                      : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <SiteFooter />
    </main>
  )
}
