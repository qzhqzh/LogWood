import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ArticleStatus } from '@prisma/client'
import sanitizeHtml from 'sanitize-html'
import { decodeArticleSlug, getArticleBySlug, increaseArticleView } from '@/modules/article'

export const dynamic = 'force-dynamic'

export default async function ArticleDetailPage({
  params,
}: {
  params: { slug: string }
}) {
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
          'pre', 'code', 'a', 'hr', 'img', 'figure', 'figcaption'
        ],
        allowedAttributes: {
          a: ['href', 'name', 'target', 'rel'],
          img: ['src', 'alt', 'title', 'width', 'height'],
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

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 pt-10 pb-16">
        <Link href="/articles" className="inline-flex items-center text-cyan-300 hover:text-cyan-200 text-sm tracking-wide mb-8">
          ← 返回文章列表
        </Link>

        <header className="mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 text-balance">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-300">
            <span className="px-3 py-1 rounded-full bg-white/10">发布于 {format(new Date(article.publishedAt || article.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
            <span className="px-3 py-1 rounded-full bg-white/10">{article.viewCount + 1} 次阅读</span>
            <span className="px-3 py-1 rounded-full bg-white/10">{article._count.comments} 条评论</span>
          </div>
        </header>

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
              className="prose prose-invert prose-lg max-w-none leading-8 text-gray-100 prose-headings:text-white prose-a:text-cyan-300 prose-strong:text-white"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <div className="prose prose-invert prose-lg max-w-none whitespace-pre-wrap leading-8 text-gray-100">
              {article.content}
            </div>
          )}
        </article>
      </div>
    </main>
  )
}
