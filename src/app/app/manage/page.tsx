'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { signIn, useSession } from 'next-auth/react'
import { TagPicker } from '@/components/tag-picker'
import { SiteFooter } from '@/components/site-footer'

const RichTextEditor = dynamic(() => import('@/components/rich-text-editor'), { ssr: false })

type AppStatus = 'draft' | 'published' | 'archived'

interface AppItem {
  id: string
  name: string
  slug: string
  appUrl: string
  title: string
  summary: string
  description: string
  previewImageUrl: string | null
  tags: string[]
  status: AppStatus
  updatedAt: string
}

export default function ManageAppsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewPreview, setPreviewPreview] = useState<string | null>(null)
  const [uploadingPreview, setUploadingPreview] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<AppStatus>('published')
  const [apps, setApps] = useState<AppItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descriptionTextLen, setDescriptionTextLen] = useState(0)

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2
      && title.trim().length >= 2
      && summary.trim().length >= 10
      && descriptionTextLen >= 20
      && appUrl.trim().length > 0
  }, [name, title, summary, descriptionTextLen, appUrl])
  const isAdmin = session?.user?.role === 'admin'

  function resetForm() {
    setEditingId(null)
    setName('')
    setAppUrl('')
    setTitle('')
    setSummary('')
    setDescription('')
    setPreviewImageUrl('')
    setPreviewFile(null)
    setPreviewPreview(null)
    setTags([])
    setStatus('published')
    setDescriptionTextLen(0)
  }

  function startEditing(app: AppItem) {
    setEditingId(app.id)
    setName(app.name)
    setAppUrl(app.appUrl)
    setTitle(app.title)
    setSummary(app.summary)
    setDescription(app.description)
    setPreviewImageUrl(app.previewImageUrl || '')
    setPreviewFile(null)
    setPreviewPreview(null)
    setTags(app.tags)
    setStatus(app.status)
    setError(null)
    // estimate plain text length from HTML for initial canSubmit check
    const plainText = app.description.replace(/<[^>]*>/g, '').trim()
    setDescriptionTextLen(plainText.length)
  }

  function handlePreviewSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewFile(file)
    setPreviewPreview(URL.createObjectURL(file))
  }

  async function handlePasteScreenshot() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const ext = imageType.split('/')[1] || 'png'
          const file = new File([blob], `screenshot-${Date.now()}.${ext}`, { type: imageType })
          setPreviewFile(file)
          setPreviewPreview(URL.createObjectURL(file))
          return
        }
      }
      setError('剪贴板中没有图片')
    } catch (e) {
      setError('无法读取剪贴板，请确保已授权剪贴板权限')
    }
  }

  async function uploadPreview(): Promise<string | null> {
    if (!previewFile) return null
    setUploadingPreview(true)
    try {
      const form = new FormData()
      form.append('file', previewFile)
      const res = await fetch('/api/uploads/app-preview', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      return data.url as string
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
      return null
    } finally {
      setUploadingPreview(false)
    }
  }

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
    return <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center px-4"><div className="cyber-card rounded-2xl p-8 text-gray-300">登录状态检查中...</div></main>
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">需要登录</h1>
          <p className="text-gray-400 mb-6">App 管理仅对登录用户开放。</p>
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: '/app/manage' })} className="cyber-button px-5 py-2 rounded-lg">前往登录</button>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">仅管理员可访问</h1>
          <p className="text-gray-400 mb-6">App 管理仅对系统管理员开放。GitHub 普通用户可在应用详情中参与评论。</p>
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: '/app/manage' })} className="cyber-button px-5 py-2 rounded-lg">切换账号</button>
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

      // Upload preview image if a new file was selected
      let finalPreviewUrl = previewImageUrl.trim()
      if (previewFile) {
        const uploaded = await uploadPreview()
        if (!uploaded) return // upload failed, error already set
        finalPreviewUrl = uploaded
      }

      const res = await fetch('/api/apps', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          name,
          appUrl,
          title,
          summary,
          description,
          previewImageUrl: finalPreviewUrl || undefined,
          tags,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || (editingId ? '更新失败' : '创建失败'))
      }

      resetForm()
      await loadApps()
    } catch (e) {
      setError(e instanceof Error ? e.message : (editingId ? '更新失败' : '创建失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">App 管理</h1>
          <Link href="/app" className="text-cyan-400 hover:text-cyan-300">前往应用工坊</Link>
        </div>

        <form onSubmit={submitApp} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">{editingId ? '编辑历史 App' : '新增 App'}</h2>
              <p className="text-sm text-gray-400 mt-1">历史应用可回填到表单中继续维护，slug 保持不变。</p>
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
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]" placeholder="内部名称 / 产品名" />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">URL</label>
              <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]" placeholder="用户看到的主标题" />
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">简介</label>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]" placeholder="一句话简介" />
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">详细表述</label>
            <RichTextEditor value={description || '<p></p>'} onChange={setDescription} onTextLengthChange={setDescriptionTextLen} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm mb-2 text-gray-300">预览图</label>
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePreviewSelect}
                    className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-cyan-600 file:text-white file:cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={handlePasteScreenshot}
                    className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-cyan-300 hover:border-cyan-400/50 hover:text-cyan-200"
                  >
                    📋 粘贴截图
                  </button>
                  <p className="text-xs text-gray-500">支持 jpg/png/webp/gif，最大 5MB</p>
                </div>
                {(previewPreview || previewImageUrl) && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-cyan-500/30 flex-shrink-0">
                    <img
                      src={previewPreview || previewImageUrl}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">状态</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AppStatus)} className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]">
                <option value="draft">草稿</option>
                <option value="published">发布</option>
                <option value="archived">归档</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-2 text-gray-300">标签</label>
            <TagPicker value={tags} onChange={setTags} disabled={loading} allowCreate={false} />
          </div>
          <button type="submit" disabled={loading || !canSubmit} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">{loading ? (editingId ? '保存中...' : '提交中...') : (editingId ? '保存修改' : '新增 App')}</button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <div className="cyber-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)] mb-4">已创建 App</h2>
          <div className="space-y-3">
            {apps.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-cyan-500/15 rounded-lg p-3">
                <div>
                  <p className="text-[var(--color-text-strong)]">{item.title}</p>
                  <p className="text-xs text-gray-500">/app/{item.slug} · {item.status}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => startEditing(item)} className="text-cyan-400 hover:text-cyan-300">编辑</button>
                  <a className="text-cyan-400 hover:text-cyan-300" href={item.appUrl} target="_blank" rel="noopener noreferrer">打开</a>
                </div>
              </div>
            ))}
            {apps.length === 0 && <p className="text-gray-500 text-sm">暂无 App，先创建一个。</p>}
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
