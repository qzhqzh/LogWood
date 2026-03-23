import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ArticleStatus } from '@prisma/client'
import sanitizeHtml from 'sanitize-html'
import { decodeArticleSlug, getArticleBySlug, increaseArticleView } from '@/modules/article'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { ArticleEngagement } from '@/components/article-engagement'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'

export const dynamic = 'force-dynamic'

export default async function ArticleDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const decodedSlug = decodeArticleSlug(params.slug)
  const article = await getArticleBySlug(decodedSlug)

  if (!article || article.status !== ArticleStatus.published) {
    notFound()
  }

  await increaseArticleView(decodedSlug)

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(article.content)
  const safeHtml = looksLikeHtml
    ? sanitizeHtml(article.content, {
        allowedTags: [
          'p', 'br', 'strong', 'em', 'u', 's', 'blockquote',
          'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'pre', 'code', 'a', 'hr', 'img', 'figure', 'figcaption', 'video'
        ],
        allowedAttributes: {
          a: ['href', 'name', 'target', 'rel'],
          img: ['src', 'alt', 'title', 'width', 'height'],
          video: ['src', 'controls', 'preload', 'class', 'width', 'height'],
          code: ['class'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        transformTags: {
          a: sanitizeHtml.simpleTransform('a', {
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
          }),
        },
      })
    : ''

  return (
    <main className="min-h-screen bg-[#08090f] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-220px] left-[-180px] w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-[140px] right-[-220px] w-[560px] h-[560px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-240px] left-[20%] w-[620px] h-[620px] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative">
        <SiteNav
          active="articles"
          actionLabel={isAdmin ? '文章管理' : undefined}
          actionHref={isAdmin ? '/articles/manage' : undefined}
          borderClassName="border-cyan-500/20"
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 pt-10 pb-16">
        <Link href="/articles" className="inline-flex items-center text-cyan-300 hover:text-cyan-200 text-sm tracking-wide mb-8">
          ← 返回文章列表
        </Link>

        <header className="mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 text-balance">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-300">
            {article.column && <span className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-200">专栏：{article.column.name}</span>}
            <span className="px-3 py-1 rounded-full bg-white/10">发布于 {format(new Date(article.publishedAt || article.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
            <span className="px-3 py-1 rounded-full bg-white/10">{article.viewCount + 1} 次阅读</span>
            <span className="px-3 py-1 rounded-full bg-white/10">{article._count.comments} 条评论</span>
          </div>
        </header>

        {article.excerpt && article.excerpt.trim().length > 0 && (
          <details className="mb-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4 group">
            <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 text-cyan-200 hover:text-cyan-100">
              <span className="text-sm sm:text-base tracking-wide">文章摘要</span>
              <span className="text-xs text-cyan-300/80 group-open:hidden">展开</span>
              <span className="text-xs text-cyan-300/80 hidden group-open:inline">收起</span>
            </summary>
            <p className="mt-3 text-sm sm:text-base leading-7 text-gray-200 whitespace-pre-wrap">
              {article.excerpt}
            </p>
          </details>
        )}

        {article.coverImageUrl && (
          <div className="mb-10">
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              width={1400}
              height={760}
              className="w-full max-h-[520px] object-cover rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
            />
          </div>
        )}

        <article className="bg-white/[0.04] backdrop-blur-sm rounded-2xl p-6 sm:p-10 lg:p-12 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          {looksLikeHtml ? (
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <div className="article-content whitespace-pre-wrap">
              {article.content}
            </div>
          )}
        </article>

        <ArticleEngagement articleId={article.id} initialCommentCount={article._count.comments} />
      </div>
      <SiteFooter />
    </main>
  )
}
