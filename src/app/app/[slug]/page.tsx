import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getAppBySlug } from '@/modules/app'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'
import {
  buildBreadcrumbList,
  buildMetadata,
  buildSoftwareApplicationJsonLd,
} from '@/shared/seo'

export const dynamic = 'force-dynamic'

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
    { name: '应用工坊', path: '/app' },
    { name: app.title, path },
  ]
  const breadcrumbJsonLd = buildBreadcrumbList(breadcrumbItems)

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
            <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-line">{app.description}</div>
            {app.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {app.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-sm">{tag}</span>
                ))}
              </div>
            )}
            <a href={app.appUrl} target="_blank" rel="noopener noreferrer" className="cyber-button px-5 py-2 rounded-lg inline-block mt-8">
              访问应用
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
      </section>
      <SiteFooter />
    </main>
  )
}
