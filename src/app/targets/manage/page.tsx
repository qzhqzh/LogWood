'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'

type TargetType = 'editor' | 'coding' | 'model' | 'prompt'

interface TargetItem {
  id: string
  name: string
  slug: string
  type: TargetType
}

export default function ManageTargetsPage() {
  const { status: sessionStatus } = useSession()
  const [name, setName] = useState('')
  const [type, setType] = useState<TargetType>('coding')
  const [logoUrl, setLogoUrl] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [developer, setDeveloper] = useState('')
  const [features, setFeatures] = useState('')
  const [targets, setTargets] = useState<TargetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => name.trim().length >= 2, [name])

  async function loadTargets() {
    const res = await fetch('/api/targets', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '加载失败')
    }
    setTargets(data.targets || [])
  }

  useEffect(() => {
    loadTargets().catch((e) => setError(e.message))
  }, [])

  if (sessionStatus === 'loading') {
    return <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4"><div className="cyber-card rounded-2xl p-8 text-gray-300">登录状态检查中...</div></main>
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">需要登录</h1>
          <p className="text-gray-400 mb-6">评测目标管理仅对登录用户开放。</p>
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: '/targets/manage' })} className="cyber-button px-5 py-2 rounded-lg">前往登录</button>
        </div>
      </main>
    )
  }

  async function submitTarget(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('请填写目标名称')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          logoUrl: logoUrl.trim() || undefined,
          description: description.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          developer: developer.trim() || undefined,
          features: features.split(',').map((item) => item.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '创建失败')
      }

      setName('')
      setType('coding')
      setLogoUrl('')
      setDescription('')
      setWebsiteUrl('')
      setDeveloper('')
      setFeatures('')
      await loadTargets()
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
          <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">评测目标管理</h1>
          <Link href="/coding" className="text-cyan-400 hover:text-cyan-300">返回 AI Coding</Link>
        </div>

        <form onSubmit={submitTarget} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-300">名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="例如 Cursor / Claude 3.7 / Prompt Deck" />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">分类</label>
              <select value={type} onChange={(e) => setType(e.target.value as TargetType)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white">
                <option value="editor">AI Editor</option>
                <option value="coding">AI Coding</option>
                <option value="model">AI Model</option>
                <option value="prompt">AI Prompt</option>
              </select>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="官网 URL" />
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="Logo URL（可选）" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input value={developer} onChange={(e) => setDeveloper(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="开发者 / 团队" />
            <input value={features} onChange={(e) => setFeatures(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="功能标签，逗号分隔" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="简要描述目标定位和能力边界" />
          <button type="submit" disabled={loading || !canSubmit} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">{loading ? '提交中...' : '新增评测目标'}</button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <div className="cyber-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">当前评测目标</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {targets.map((item) => (
              <div key={item.id} className="border border-cyan-500/15 rounded-lg p-3">
                <p className="text-white">{item.name}</p>
                <p className="text-xs text-gray-500">{item.type} / {item.slug}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
