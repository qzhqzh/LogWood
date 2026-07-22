import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { listApps } from '@/modules/app'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { JsonLd } from '@/components/json-ld'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const revalidate = 300

export const metadata: Metadata = buildMetadata({
  title: '画廊',
  description: '美图、创意与示例站展览——把值得留下的视觉与作品陈列在空心树洞里',
  path: '/app',
})

export default async function GalleryPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminSession(session)
  const { apps } = await listApps({ page: 1, pageSize: 24 })

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <JsonLd
        value={buildBreadcrumbList([
          { name: '首页', path: '/' },
          { name: '画廊', path: '/app' },
        ])}
      />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav
        active="gallery"
        actionLabel={isAdmin ? '画廊管理' : undefined}
        actionHref={isAdmin ? '/app/manage' : undefined}
      />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="mb-12">
          <div>
            <div className="inline-block mb-4 px-4 py-1 border border-purple-500/30 rounded-full bg-purple-500/5">
              <span className="text-purple-400 text-sm tracking-widest uppercase">GALLERY</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] mb-4 gradient-text">画廊</h1>
            <p className="text-gray-400 text-lg max-w-3xl">
              展示美图、创意与示例网站。既有收藏以画廊作品继续陈列，重点看见标题、简介、详述与预览图。
            </p>
          </div>
        </div>

        {apps.length === 0 ? (
          <div className="cyber-card rounded-2xl p-10 text-center">
            <p className="text-gray-400 mb-4">画廊还空着，放进第一件作品吧。</p>
            <Link href="/app/manage" className="cyber-button px-5 py-2 rounded-lg inline-block">新增作品</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {apps.map((app: (typeof apps)[number]) => (
              <Link key={app.id} href={`/app/${app.slug}`} className="cyber-card rounded-2xl overflow-hidden hover:scale-[1.01] transition-transform">
                <div className="relative h-48 bg-gradient-to-br from-cyan-500/15 to-purple-500/15">
                  {app.previewImageUrl ? (
                    <Image src={app.previewImageUrl} alt={app.title} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">暂无预览图</div>
                  )}
                </div>
                <div className="p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-400 mb-2">{app.name}</p>
                  <h2 className="text-2xl font-semibold text-[var(--color-text-strong)] mb-3">{app.title}</h2>
                  <p className="text-gray-300 mb-4 line-clamp-2">{app.summary}</p>
                  <p className="text-gray-500 text-sm line-clamp-3">{app.description}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  )
}
