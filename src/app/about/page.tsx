import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Bot, CircleDot, GitBranch, UserRound } from 'lucide-react'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { AUTHOR_PROFILE, AUTHOR_TRACE } from '@/content/author-profile'
import { encodeArticleSlug, listArticles } from '@/modules/article'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const metadata: Metadata = buildMetadata({
  title: '关于秦',
  description: '秦的作者札页：造器，筑界，观心。记录工具、规则、内在世界，以及人与 AI 如何共同把灵感变成可审计作品。',
  path: '/about',
})

export const dynamic = 'force-dynamic'

const creationFlow = [
  { title: '人的信号', detail: '经验、情绪、问题与原始判断', icon: UserRound },
  { title: 'AI 的草稿', detail: '整理、连接、提出待验证结构', icon: Bot },
  { title: '人的门禁', detail: '核对来源、版本、证据与表达', icon: GitBranch },
  { title: '可追溯作品', detail: '进入笔记、Skill、视觉收藏与评测', icon: CircleDot },
] as const

const entryLinks = [
  { href: '/candidates', label: '收集箱', detail: '收住还没想清楚的信号' },
  { href: '/skills', label: '提示库', detail: '查看可执行提示词、真实效果与证据' },
  { href: '/articles', label: '笔记', detail: '读整理后的长期记录' },
  { href: '/forge', label: 'AI 整理', detail: '看人和 AI 如何生成草稿' },
] as const

function AuthorInspectorDetails() {
  return (
    <dl className="mt-6 space-y-5 text-sm leading-6">
      <div>
        <dt className="text-[var(--color-author-muted)]">作者来源</dt>
        <dd className="mt-1 break-words text-[var(--color-author-ink)]">{AUTHOR_TRACE.source}</dd>
      </div>
      <div>
        <dt className="text-[var(--color-author-muted)]">保留</dt>
        <dd className="mt-1 text-[var(--color-author-ink)]">{AUTHOR_TRACE.narrative}</dd>
      </div>
      <div>
        <dt className="text-[var(--color-author-muted)]">不迁移</dt>
        <dd className="mt-1 text-[var(--color-author-ink)]">{AUTHOR_TRACE.excluded}</dd>
      </div>
      <div>
        <dt className="text-[var(--color-author-muted)]">AI 在本页的角色</dt>
        <dd className="mt-1 text-[var(--color-author-ink)]">重组既有内容与建立连接；不新增作者履历和事实主张。</dd>
      </div>
    </dl>
  )
}

export default async function AboutPage() {
  const { articles } = await listArticles({ pageSize: 4 })
  return (
    <main className="author-surface min-h-screen">
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: '关于秦', path: '/about' },
      ])} />
      <SiteNav active="about" />

      <div className="mx-auto grid max-w-6xl gap-16 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:px-10 lg:pt-20">
        <div className="min-w-0">
          <header className="max-w-[68ch] border-b border-[var(--color-author-line)] pb-14">
            <h1 className="author-display text-[clamp(3.75rem,11vw,6rem)] leading-none">{AUTHOR_PROFILE.name}</h1>
            <div className="mt-10 space-y-1 text-lg leading-8 text-[var(--color-author-ink)] sm:text-xl sm:leading-9">
              {AUTHOR_PROFILE.opening.map((line) => <p key={line}>{line}</p>)}
            </div>
            <div className="mt-8 space-y-1 text-base leading-8 text-[var(--color-author-muted)]">
              {AUTHOR_PROFILE.reflection.map((line) => <p key={line}>{line}</p>)}
            </div>
            <p className="author-motto mt-12 text-2xl sm:text-3xl">{AUTHOR_PROFILE.motto}</p>
          </header>

          <details className="border-b border-[var(--color-author-line)] py-5 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--color-author-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-author-accent)]">
              Inspector / 来源检查
              <span className="text-[var(--color-author-accent)]" aria-hidden>＋</span>
            </summary>
            <AuthorInspectorDetails />
          </details>

          <section className="py-14" aria-labelledby="signal-heading">
            <h2 id="signal-heading" className="author-section-title">{AUTHOR_PROFILE.signal}</h2>
            <p className="mt-5 max-w-[64ch] text-base leading-8 text-[var(--color-author-muted)]">
              空心树洞是这句话的工作版本：先承认噪声，再让人和 AI 各自留下可辨认的贡献，最后由人决定什么值得公开、继续或放弃。
            </p>
            <ol className="author-flow mt-10 grid gap-0 border-y border-[var(--color-author-line)] sm:grid-cols-2 xl:grid-cols-4">
              {creationFlow.map((item, index) => {
                const Icon = item.icon
                return (
                  <li key={item.title} className="relative px-4 py-6 sm:px-5">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-[var(--color-author-accent)]" strokeWidth={1.5} aria-hidden />
                      <h3 className="text-base font-semibold text-[var(--color-author-ink)]">{item.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-author-muted)]">{item.detail}</p>
                    {index < creationFlow.length - 1 ? <span className="author-flow-mark" aria-hidden /> : null}
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="border-t border-[var(--color-author-line)] py-14" id="now" aria-labelledby="now-heading">
            <h2 id="now-heading" className="author-section-title">现在</h2>
            <ul className="mt-8 space-y-4">
              {AUTHOR_PROFILE.now.map((item) => (
                <li key={item} className="flex max-w-[68ch] gap-4 text-base leading-8 text-[var(--color-author-ink)]">
                  <span className="mt-[0.8rem] h-1.5 w-1.5 shrink-0 bg-[var(--color-author-accent)]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-[var(--color-author-line)] py-14" id="projects" aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="author-section-title">项目</h2>
            <div className="mt-8 divide-y divide-[var(--color-author-line)] border-y border-[var(--color-author-line)]">
              {AUTHOR_PROFILE.projects.map((project) => (
                <article key={project.title} className="grid gap-3 py-7 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-author-ink)]">{project.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-[var(--color-author-muted)]">{project.tags.join(' · ')}</p>
                  </div>
                  <p className="max-w-[52ch] text-base leading-8 text-[var(--color-author-muted)]">{project.description}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="grid border-t border-[var(--color-author-line)] md:grid-cols-2">
            <section className="py-14 md:pr-10" aria-labelledby="values-heading">
              <h2 id="values-heading" className="author-section-title">相信</h2>
              <div className="mt-8 space-y-3 text-lg leading-8 text-[var(--color-author-ink)]">
                {AUTHOR_PROFILE.values.map((item) => <p key={item}>{item}</p>)}
              </div>
            </section>
            <section className="border-t border-[var(--color-author-line)] py-14 md:border-l md:border-t-0 md:pl-10" aria-labelledby="likes-heading">
              <h2 id="likes-heading" className="author-section-title">喜欢</h2>
              <div className="mt-8 space-y-3 text-lg leading-8 text-[var(--color-author-ink)]">
                {AUTHOR_PROFILE.likes.map((item) => <p key={item}>{item}</p>)}
              </div>
            </section>
          </div>

          <section className="border-t border-[var(--color-author-line)] py-14" id="notes" aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="author-section-title">札记</h2>
            <div className="mt-8 divide-y divide-[var(--color-author-line)] border-y border-[var(--color-author-line)]">
              {articles.length > 0 ? articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${encodeArticleSlug(article.slug)}`}
                  className="group flex items-start justify-between gap-6 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-author-accent)]"
                >
                  <span>
                    <span className="block text-lg font-semibold text-[var(--color-author-ink)] group-hover:text-[var(--color-author-accent)]">{article.title}</span>
                    <span className="mt-2 block max-w-[58ch] text-sm leading-6 text-[var(--color-author-muted)]">{article.excerpt || '打开札记，查看完整记录与创作来源。'}</span>
                  </span>
                  <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-[var(--color-author-muted)] group-hover:text-[var(--color-author-accent)]" strokeWidth={1.5} aria-hidden />
                </Link>
              )) : (
                <p className="py-6 text-sm leading-6 text-[var(--color-author-muted)]">公开札记尚未形成；草稿不会越过人工发布门禁出现在这里。</p>
              )}
            </div>
          </section>

          <section className="border-t border-[var(--color-author-line)] py-14" id="links" aria-labelledby="links-heading">
            <h2 id="links-heading" className="author-section-title">入口</h2>
            <div className="mt-8 divide-y divide-[var(--color-author-line)] border-y border-[var(--color-author-line)]">
              {entryLinks.map((entry) => (
                <Link key={entry.href} href={entry.href} className="group flex items-center justify-between gap-6 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-author-accent)]">
                  <span>
                    <span className="block text-lg font-semibold text-[var(--color-author-ink)] group-hover:text-[var(--color-author-accent)]">{entry.label}</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--color-author-muted)]">{entry.detail}</span>
                  </span>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-[var(--color-author-muted)] group-hover:text-[var(--color-author-accent)]" strokeWidth={1.5} aria-hidden />
                </Link>
              ))}
            </div>
          </section>

          <section className="border-t border-[var(--color-author-line)] py-14" id="contact" aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="author-section-title">通联</h2>
            <p className="mt-8 max-w-[56ch] text-lg leading-9 text-[var(--color-author-ink)]">
              如果你也对 AI 工具、游戏化系统、个人知识系统，或有余味的网页感兴趣，欢迎从公开仓库开始交流。
            </p>
            <a
              href="https://github.com/qzhqzh"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex min-h-11 items-center gap-2 border-b border-[var(--color-author-ink)] text-base font-semibold text-[var(--color-author-ink)] hover:border-[var(--color-author-accent)] hover:text-[var(--color-author-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-author-accent)]"
            >
              GitHub / qzhqzh
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </a>
          </section>
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-labelledby="inspector-heading">
          <div className="border-y border-[var(--color-author-line)] py-6">
            <h2 id="inspector-heading" className="text-sm font-semibold text-[var(--color-author-ink)]">Inspector / 来源检查</h2>
            <AuthorInspectorDetails />
          </div>
        </aside>
      </div>
      <SiteFooter />
    </main>
  )
}
