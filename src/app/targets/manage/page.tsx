'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { TagPicker } from '@/components/tag-picker'
import { SiteFooter } from '@/components/site-footer'

type TargetType = 'editor' | 'coding' | 'model' | 'prompt'

const TARGET_TYPE_ITEMS: Array<{ key: TargetType; label: string; href: string; backHref: string }> = [
  { key: 'editor', label: 'AI Editor', href: '/targets/manage/editor', backHref: '/editor' },
  { key: 'coding', label: 'AI Coding', href: '/targets/manage/coding', backHref: '/coding?category=coding' },
  { key: 'model', label: 'AI Model', href: '/targets/manage/model', backHref: '/coding?category=model' },
  { key: 'prompt', label: 'AI Prompt', href: '/targets/manage/prompt', backHref: '/coding?category=prompt' },
]

interface TargetItem {
  id: string
  name: string
  slug: string
  type: TargetType
  logoUrl?: string | null
  description?: string | null
  websiteUrl?: string | null
  developer?: string | null
  features: string[]
}

function parseScopedType(value: string | null): TargetType | null {
  if (value === 'editor' || value === 'coding' || value === 'model' || value === 'prompt') {
    return value
  }
  return null
}

export default function ManageTargetsPage() {
  const searchParams = useSearchParams()
  const scopedType = parseScopedType(searchParams.get('type'))
  const managePath = scopedType ? `/targets/manage?type=${scopedType}` : '/targets/manage'
  const activeTypeItem = scopedType ? TARGET_TYPE_ITEMS.find((item) => item.key === scopedType) : null
  const titleText = activeTypeItem ? `${activeTypeItem.label} 评测管理` : '评测目标管理'
  const backHref = activeTypeItem?.backHref || '/coding'
  const { data: session, status: sessionStatus } = useSession()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<TargetType>(scopedType || 'coding')
  const [logoUrl, setLogoUrl] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [developer, setDeveloper] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const [targets, setTargets] = useState<TargetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const visibleTargets = useMemo(
    () => (scopedType ? targets.filter((item) => item.type === scopedType) : targets),
    [scopedType, targets]
  )

  const canSubmit = useMemo(() => name.trim().length >= 2, [name])
  const isAdmin = session?.user?.role === 'admin'

  function resetForm() {
    setEditingId(null)
    setName('')
    setType(scopedType || 'coding')
    setLogoUrl('')
    setDescription('')
    setWebsiteUrl('')
    setDeveloper('')
    setFeatures([])
  }

  function startEditing(target: TargetItem) {
    setEditingId(target.id)
    setName(target.name)
    setType(scopedType || target.type)
    setLogoUrl(target.logoUrl || '')
    setDescription(target.description || '')
    setWebsiteUrl(target.websiteUrl || '')
    setDeveloper(target.developer || '')
    setFeatures(target.features)
    setError(null)
  }

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
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: managePath })} className="cyber-button px-5 py-2 rounded-lg">前往登录</button>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">仅管理员可访问</h1>
          <p className="text-gray-400 mb-6">评测目标管理仅对系统管理员开放。GitHub 普通用户可在目标详情中参与评论。</p>
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: managePath })} className="cyber-button px-5 py-2 rounded-lg">切换账号</button>
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
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          name,
          type: scopedType || type,
          logoUrl: logoUrl.trim() || undefined,
          description: description.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          developer: developer.trim() || undefined,
          features,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || (editingId ? '更新失败' : '创建失败'))
      }

      resetForm()
      await loadTargets()
    } catch (e) {
      setError(e instanceof Error ? e.message : (editingId ? '更新失败' : '创建失败'))
    } finally {
      setLoading(false)
    }
  }

  async function removeTarget(target: TargetItem) {
    const confirmed = window.confirm(`确认删除评测目标「${target.name}」吗？此操作不可恢复。`)
    if (!confirmed) return

    try {
      setDeletingId(target.id)
      setError(null)
      const res = await fetch('/api/targets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '删除失败')
      }

      if (editingId === target.id) {
        resetForm()
      }
      await loadTargets()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">{titleText}</h1>
          <Link href={backHref} className="text-cyan-400 hover:text-cyan-300">返回列表页</Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {TARGET_TYPE_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                scopedType === item.key
                  ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300'
                  : 'border-cyan-500/20 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/40'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <form onSubmit={submitTarget} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{editingId ? '编辑评测目标' : '新增评测目标'}</h2>
              <p className="text-sm text-gray-400 mt-1">可编辑历史目标，并从统一标签池选择或快速创建标签。</p>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-300 hover:border-cyan-400/50 hover:text-cyan-200">
                取消编辑
              </button>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-300">名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="例如 Cursor / Claude 3.7 / Prompt Deck" />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">分类</label>
              <select
                value={scopedType || type}
                onChange={(e) => setType(e.target.value as TargetType)}
                disabled={Boolean(scopedType)}
                className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white disabled:opacity-70 disabled:cursor-not-allowed"
              >
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
            <div className="text-xs text-gray-500 flex items-center">标签已改为标签池维护，可在下方选择或快速创建。</div>
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">标签</label>
            <TagPicker value={features} onChange={setFeatures} disabled={loading} />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white" placeholder="简要描述目标定位和能力边界" />
          <button type="submit" disabled={loading || !canSubmit} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">{loading ? (editingId ? '保存中...' : '提交中...') : (editingId ? '保存修改' : '新增评测目标')}</button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <div className="cyber-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">当前评测目标</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {visibleTargets.map((item) => (
              <div key={item.id} className="border border-cyan-500/15 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.type} / {item.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => startEditing(item)} className="text-cyan-400 hover:text-cyan-300 text-sm">编辑</button>
                    <button
                      type="button"
                      onClick={() => removeTarget(item)}
                      disabled={deletingId === item.id}
                      className="text-red-400 hover:text-red-300 text-sm disabled:opacity-60"
                    >
                      {deletingId === item.id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>
                {item.features.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.features.map((feature) => (
                      <span key={feature} className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-xs">{feature}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {visibleTargets.length === 0 && (
              <p className="text-sm text-gray-500">当前分类暂无目标，可在上方新建。</p>
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
