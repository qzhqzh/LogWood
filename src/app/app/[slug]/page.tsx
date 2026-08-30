import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getAppBySlug } from '@/modules/app'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { EvaluationPanel } from '@/components/evaluation-panel'
import { ReviewPanel } from '@/components/review-panel'
import { LifecycleOriginHistory } from '@/components/lifecycle-origin-history'
import { sanitizeArticleHtml } from '@/modules/article/sanitize'
import {
  buildBreadcrumbList,
  buildMetadata,
  buildSoftwareApplicationJsonLd,
} from '@/shared/seo'

export const revalidate = 300

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const app = await getAppBySlug(params.slug)
  if (!app || app.status !== 'published') return { title: 'Not Found' }
  return buildMetadata({
    title: app.title,
    description: app.summary,
    path: `/app/${app.slug}`,
    image: app.previewImageUrl ?? null,
  })
}

interface AppDetailPageProps {
  params: Promise<{ slug: string }>
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
  const { slug } = await params
  const app = await getAppBySlug(slug)

  if (!app || app.status !== 'published') {
    notFound()
  }

  const path = `/app/${app.slug}`
  const jsonLd = buildSoftwareApplicationJsonLd({
    name: app.title,
    description: app.summary,
    url: path,
    applicationCategory: 'WebApplication',
    downloadUrl: app.appUrl,
  })

  const breadcrumbItems = [
    { name: '首页', path: '/' },
    { name: '画廊', path: '/app' },
    { name: app.title, path },
  ]
  const breadcrumbJsonLd = buildBreadcrumbList(breadcrumbItems)
  const safeDescription = sanitizeArticleHtml(app.description)

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd value={jsonLd} />
      <JsonLd value={breadcrumbJsonLd} />
      <SiteNav active="app" borderClassName="border-cyan-500/20" />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs
          items={breadcrumbItems.map((item, index) =>
            index === breadcrumbItems.length - 1
              ? { name: item.name }
              : { name: item.name, href: item.path },
          )}
          className="mb-6"
        />
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
          <div className="cyber-card rounded-3xl p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400 mb-3">{app.name}</p>
            <h1 className="text-4xl font-bold font-['Orbitron'] text-[var(--color-text-strong)] mb-4">{app.title}</h1>
            <p className="text-xl text-gray-300 mb-6">{app.summary}</p>
            <div className="prose prose-invert max-w-none text-gray-300 tiptap-editor-content" dangerouslySetInnerHTML={{ __html: safeDescription }} />
            {app.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {app.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-sm">{tag}</span>
                ))}
              </div>
            )}
            <a href={app.appUrl} target="_blank" rel="noopener noreferrer" className="cyber-button px-5 py-2 rounded-lg inline-block mt-8">
              访问项目
            </a>
          </div>

          <div className="cyber-card rounded-3xl p-4">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-500/15 to-purple-500/15">
              {app.previewImageUrl ? (
                <Image src={app.previewImageUrl} alt={app.title} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">暂无预览图</div>
              )}
            </div>
          </div>
        </div>

        {app.visualAssets.length > 0 ? (
          <details className="mt-8 border-y border-divider py-5">
            <summary className="min-h-11 cursor-pointer list-none text-sm font-semibold text-[var(--color-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
              Inspector / 视觉资产来源与权利
            </summary>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {app.visualAssets.map((asset: {
                id: string
                sourceCollection: string
                sourcePath: string
                originalSha256: string
                derivedSha256: string
                width: number
                height: number
                mimeType: string
                rightsStatus: string
                rightsNote: string | null
              }) => (
                <dl key={asset.id} className="space-y-2 text-xs leading-5 text-soft">
                  <div><dt className="inline text-muted">来源：</dt><dd className="inline">{asset.sourceCollection} / {asset.sourcePath}</dd></div>
                  <div><dt className="inline text-muted">原始 SHA-256：</dt><dd className="inline break-all">{asset.originalSha256}</dd></div>
                  <div><dt className="inline text-muted">派生 SHA-256：</dt><dd className="inline break-all">{asset.derivedSha256}</dd></div>
                  <div><dt className="inline text-muted">格式：</dt><dd className="inline">{asset.width} × {asset.height} · {asset.mimeType}</dd></div>
                  <div><dt className="inline text-muted">权利：</dt><dd className="inline">{asset.rightsStatus}{asset.rightsNote ? ` · ${asset.rightsNote}` : ''}</dd></div>
                </dl>
              ))}
            </div>
          </details>
        ) : null}

        <LifecycleOriginHistory subjectType="app" subjectId={app.id} />
        <EvaluationPanel subjectType="app" subjectId={app.id} />
        <ReviewPanel subjectType="app" subjectId={app.id} title="自由记录、提问或吐槽" />
      </section>
      <SiteFooter />
    </main>
  )
}
