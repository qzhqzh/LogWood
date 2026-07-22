'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { SiteFooter } from '@/components/site-footer'
import { CANDIDATE_STATUS_LABELS } from '@/modules/candidate/constants'

type CandidateStatus = 'watching' | 'evaluating' | 'promoted' | 'dropped'

interface CandidateItem {
  id: string
  title: string
  slug: string
  summary?: string | null
  websiteUrl?: string | null
  sourceUrl?: string | null
  logoUrl?: string | null
  previewImageUrl?: string | null
  tags: string[]
  status: CandidateStatus
  sortOrder: number
  reviewCount?: number
  promotedTo?: string | null
}

const STATUS_OPTIONS = (Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[]).filter(
  (s) => s !== 'promoted',
)

export default function ManageCandidatesPage() {
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [candidates, setCandidates] = useState<CandidateItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [status, setStatus] = useState<CandidateStatus>('watching')
  const [loading, setLoading] = useState(false)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => title.trim().length >= 2, [title])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setSummary('')
    setWebsiteUrl('')
    setSourceUrl('')
    setLogoUrl('')
    setPreviewImageUrl('')
    setTagsText('')
    setStatus('watching')
  }

  function startEditing(item: CandidateItem) {
    setEditingId(item.id)
    setTitle(item.title)
    setSummary(item.summary || '')
    setWebsiteUrl(item.websiteUrl || '')
    setSourceUrl(item.sourceUrl || '')
    setLogoUrl(item.logoUrl || '')
    setPreviewImageUrl(item.previewImageUrl || '')
    setTagsText(item.tags.join(', '))
    setStatus(item.status === 'promoted' ? 'evaluating' : item.status)
    setError(null)
  }

  async function loadCandidates() {
    const res = await fetch('/api/candidates?admin=1', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '加载失败')
    setCandidates(data.candidates || [])
  }

  useEffect(() => {
    if (!isAdmin) return
    loadCandidates().catch((e) => setError(e.message))
  }, [isAdmin])

  useEffect(() => {
    if (!editId || candidates.length === 0) return
    const found = candidates.find((c) => c.id === editId)
    if (found) startEditing(found)
  }, [editId, candidates])

  async function submitCandidate(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('请填写标题')
      return
    }
    const tags = tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/candidates', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          title,
          summary: summary.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          previewImageUrl: previewImageUrl.trim() || undefined,
          tags,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      resetForm()
      await loadCandidates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  async function removeCandidate(item: CandidateItem) {
    if (!window.confirm(`确认删除候选「${item.title}」？`)) return
    try {
      setError(null)
      const res = await fetch('/api/candidates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '删除失败')
      if (editingId === item.id) resetForm()
      await loadCandidates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function promote(item: CandidateItem, to: 'tool' | 'gallery') {
    const label = to === 'tool' ? '工具收藏' : '画廊'
    if (!window.confirm(`将「${item.title}」晋升到${label}？`)) return
    try {
      setPromotingId(item.id)
      setError(null)
      const res = await fetch(`/api/candidates/${item.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          targetType: to === 'tool' ? 'coding' : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '晋升失败')
      await loadCandidates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '晋升失败')
    } finally {
      setPromotingId(null)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center">
        <div className="cyber-card rounded-2xl p-8 text-muted">登录状态检查中...</div>
      </main>
    )
  }

  if (sessionStatus !== 'authenticated' || !isAdmin) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">需要管理员</h1>
          <p className="text-muted mb-6">候选管理仅对管理员开放。</p>
          <button
            type="button"
            onClick={() => signIn(undefined, { callbackUrl: '/candidates/manage' })}
            className="cyber-button px-5 py-2 rounded-lg"
          >
            前往登录
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <p className="text-xs tracking-[0.28em] text-amber-300/80 uppercase mb-2">SHORTLIST</p>
            <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">候选管理</h1>
          </div>
          <Link href="/candidates" className="text-amber-300 hover:text-amber-200">回候选评测</Link>
        </div>

        <form onSubmit={submitCandidate} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">
              {editingId ? '编辑候选' : '新增候选'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm text-cyan-300 border border-cyan-500/30 rounded-lg px-3 py-1.5">
                取消编辑
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-300">标题</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="项目名称" />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">状态</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as CandidateStatus)} className="cyber-input w-full rounded-lg px-3 py-2">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{CANDIDATE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-300">简介</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="为什么值得观察" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="官网 URL" />
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="来源 / 仓库 URL" />
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="Logo URL" />
            <input value={previewImageUrl} onChange={(e) => setPreviewImageUrl(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="预览图 URL / 路径" />
          </div>

          <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="标签（逗号分隔）" />

          <button type="submit" disabled={loading || !canSubmit} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">
            {loading ? '保存中…' : editingId ? '保存修改' : '创建候选'}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <section className="cyber-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)] mb-4">已收录 ({candidates.length})</h2>
          <div className="space-y-3">
            {candidates.map((item) => (
              <div key={item.id} className="border border-amber-500/15 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div>
                    <p className="text-[var(--color-text-strong)] font-medium">{item.title}</p>
                    <p className="text-xs text-soft mt-1">
                      {CANDIDATE_STATUS_LABELS[item.status] || item.status}
                      {item.reviewCount != null ? ` · ${item.reviewCount} 评测` : ''}
                      {' · '}/candidates/{item.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <Link href={`/candidates/${item.slug}`} className="text-purple-300 hover:text-purple-200">预览</Link>
                    <button type="button" onClick={() => startEditing(item)} className="text-cyan-400 hover:text-cyan-300">编辑</button>
                    {item.status !== 'promoted' && item.status !== 'dropped' && (
                      <>
                        <button
                          type="button"
                          disabled={promotingId === item.id}
                          onClick={() => promote(item, 'tool')}
                          className="text-amber-300 hover:text-amber-200 disabled:opacity-50"
                        >
                          晋升工具
                        </button>
                        <button
                          type="button"
                          disabled={promotingId === item.id}
                          onClick={() => promote(item, 'gallery')}
                          className="text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                        >
                          晋升画廊
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => removeCandidate(item)} className="text-red-400 hover:text-red-300">删除</button>
                  </div>
                </div>
              </div>
            ))}
            {candidates.length === 0 && <p className="text-soft text-sm">还没有候选，用上方表单创建。</p>}
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  )
}
