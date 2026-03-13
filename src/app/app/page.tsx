import Link from 'next/link'
import Image from 'next/image'
import { listApps } from '@/modules/app'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'

export const dynamic = 'force-dynamic'

export default async function AppWorkshopPage() {
  const { apps } = await listApps({ page: 1, pageSize: 24 })

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <SiteNav active="app" actionLabel="App管理" actionHref="/app/manage" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="mb-12">
          <div>
            <div className="inline-block mb-4 px-4 py-1 border border-purple-500/30 rounded-full bg-purple-500/5">
              <span className="text-purple-400 text-sm tracking-widest uppercase">APP WORKSHOP</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] mb-4 gradient-text">应用工坊</h1>
            <p className="text-gray-400 text-lg max-w-3xl">
              收录基于 AI Coding 生态构建的应用、工作流与成品工具，面向用户重点展示标题、简介、详细描述和预览图。
            </p>
          </div>
        </div>

        {apps.length === 0 ? (
          <div className="cyber-card rounded-2xl p-10 text-center">
            <p className="text-gray-400 mb-4">当前还没有上架的 App。</p>
            <Link href="/app/manage" className="cyber-button px-5 py-2 rounded-lg inline-block">新增第一个 App</Link>
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
                  <h2 className="text-2xl font-semibold text-white mb-3">{app.title}</h2>
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
