import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getAppBySlug } from '@/modules/app'

export const dynamic = 'force-dynamic'

interface AppDetailPageProps {
  params: Promise<{ slug: string }>
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
  const { slug } = await params
  const app = await getAppBySlug(slug)

  if (!app || app.status !== 'published') {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <nav className="border-b border-cyan-500/20 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold font-['Orbitron'] gradient-text">LogWood</Link>
            <div className="flex items-center gap-6">
              <Link href="/coding" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium tracking-wide">AI Coding</Link>
              <Link href="/app" className="text-purple-400 font-medium tracking-wide">应用工坊</Link>
              <Link href="/articles" className="text-pink-400 hover:text-pink-300 transition-colors font-medium tracking-wide">社区文章</Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
          <div className="cyber-card rounded-3xl p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400 mb-3">{app.name}</p>
            <h1 className="text-4xl font-bold font-['Orbitron'] text-white mb-4">{app.title}</h1>
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
    </main>
  )
}
