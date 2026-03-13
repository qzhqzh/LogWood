'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'

type AppStatus = 'draft' | 'published' | 'archived'

interface AppItem {
  id: string
  name: string
  slug: string
  appUrl: string
  title: string
  summary: string
  status: AppStatus
  updatedAt: string
}

export default function ManageAppsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [name, setName] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<AppStatus>('published')
  const [apps, setApps] = useState<AppItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2
      && title.trim().length >= 2
      && summary.trim().length >= 10
      && description.trim().length >= 20
      && appUrl.trim().length > 0
  }, [name, title, summary, description, appUrl])

  async function loadApps() {
    const res = await fetch('/api/apps?manage=true', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '加载失败')
    }
    setApps(data.apps || [])
  }

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    loadApps().catch((e) => setError(e.message))
  }, [sessionStatus])

  if (sessionStatus === 'loading') {
    return <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4"><div className="cyber-card rounded-2xl p-8 text-gray-300">登录状态检查中...</div></main>
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">需要登录</h1>
          <p className="text-gray-400 mb-6">App 管理仅对登录用户开放。</p>
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: '/app/manage' })} className="cyber-button px-5 py-2 rounded-lg">前往登录</button>
        </div>
      </main>
    )
  }

  async function submitApp(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('请完整填写应用信息后再提交')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          appUrl,
          title,
          summary,
          description,
          previewImageUrl: previewImageUrl.trim() || undefined,
          tags: tags.split(',').map((item) => item.trim()).filter(Boolean),
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '创建失败')
      }

      setName('')
      setAppUrl('')
      setTitle('')
      setSummary('')
      setDescription('')
      setPreviewImageUrl('')
      setTags('')
      setStatus('published')
      await loadApps()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">App 管理</h1>
          <Link href="/app" className="text-cyan-400 hover:text-cyan-300">前往应用工坊</Link>
        </div>

        <form onSubmit={submitApp} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-300">名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="内部名称 / 产品名" />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">URL</label>
              <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="用户看到的主标题" />
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">简介</label>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="一句话简介" />
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">详细表述</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="产品能力、使用方式、适合人群、差异点..." />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-300">预览图</label>
              <input value={previewImageUrl} onChange={(e) => setPreviewImageUrl(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">标签</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="逗号分隔，如 workflow,agent" />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">状态</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AppStatus)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white">
                <option value="draft">草稿</option>
                <option value="published">发布</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={loading || !canSubmit} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">{loading ? '提交中...' : '新增 App'}</button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <div className="cyber-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">已创建 App</h2>
          <div className="space-y-3">
            {apps.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-cyan-500/15 rounded-lg p-3">
                <div>
                  <p className="text-white">{item.title}</p>
                  <p className="text-xs text-gray-500">/app/{item.slug} · {item.status}</p>
                </div>
                <a className="text-cyan-400 hover:text-cyan-300" href={item.appUrl} target="_blank" rel="noopener noreferrer">打开</a>
              </div>
            ))}
            {apps.length === 0 && <p className="text-gray-500 text-sm">暂无 App，先创建一个。</p>}
          </div>
        </div>
      </div>
    </main>
  )
}
