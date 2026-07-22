'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { SiteFooter } from '@/components/site-footer'
import { SKILL_CATEGORY_LABELS, SKILL_CATEGORY_ORDER } from '@/modules/skill/constants'

type SkillStatus = 'draft' | 'published' | 'archived'

interface SkillItem {
  id: string
  title: string
  slug: string
  category: string
  summary?: string | null
  prompt: string
  effectImageUrl?: string | null
  effectNote?: string | null
  sourceUrl?: string | null
  tags: string[]
  status: SkillStatus
  sortOrder: number
}

const CATEGORY_OPTIONS = SKILL_CATEGORY_ORDER.map((key) => ({
  value: key,
  label: SKILL_CATEGORY_LABELS[key],
}))

export default function ManageSkillsPage() {
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [skills, setSkills] = useState<SkillItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('frontend')
  const [customCategory, setCustomCategory] = useState('')
  const [summary, setSummary] = useState('')
  const [prompt, setPrompt] = useState('')
  const [effectImageUrl, setEffectImageUrl] = useState('')
  const [effectNote, setEffectNote] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [status, setStatus] = useState<SkillStatus>('published')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(
    () => title.trim().length >= 2 && prompt.trim().length >= 8,
    [title, prompt],
  )

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setCategory('frontend')
    setCustomCategory('')
    setSummary('')
    setPrompt('')
    setEffectImageUrl('')
    setEffectNote('')
    setSourceUrl('')
    setTagsText('')
    setStatus('published')
  }

  function startEditing(skill: SkillItem) {
    setEditingId(skill.id)
    setTitle(skill.title)
    const known = CATEGORY_OPTIONS.some((c) => c.value === skill.category)
    setCategory(known ? skill.category : 'other')
    setCustomCategory(known ? '' : skill.category)
    setSummary(skill.summary || '')
    setPrompt(skill.prompt)
    setEffectImageUrl(skill.effectImageUrl || '')
    setEffectNote(skill.effectNote || '')
    setSourceUrl(skill.sourceUrl || '')
    setTagsText(skill.tags.join(', '))
    setStatus(skill.status)
    setError(null)
  }

  async function loadSkills() {
    const res = await fetch('/api/skills?admin=1', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '加载失败')
    setSkills(data.skills || [])
  }

  useEffect(() => {
    if (!isAdmin) return
    loadSkills().catch((e) => setError(e.message))
  }, [isAdmin])

  useEffect(() => {
    if (!editId || skills.length === 0) return
    const found = skills.find((s) => s.id === editId)
    if (found) startEditing(found)
  }, [editId, skills])

  async function uploadEffect(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/uploads/skill-effect', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      setEffectImageUrl(data.url as string)
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function submitSkill(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('请填写标题与提示词内容')
      return
    }
    const resolvedCategory = customCategory.trim() || category
    const tags = tagsText
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/skills', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          title,
          category: resolvedCategory,
          summary: summary.trim() || undefined,
          prompt,
          effectImageUrl: effectImageUrl.trim() || undefined,
          effectNote: effectNote.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          tags,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存失败')
      resetForm()
      await loadSkills()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  async function removeSkill(skill: SkillItem) {
    if (!window.confirm(`确认删除 Skill「${skill.title}」？`)) return
    try {
      setError(null)
      const res = await fetch('/api/skills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: skill.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '删除失败')
      if (editingId === skill.id) resetForm()
      await loadSkills()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
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
          <p className="text-muted mb-6">Skill 管理仅对管理员开放。</p>
          <button
            type="button"
            onClick={() => signIn(undefined, { callbackUrl: '/skills/manage' })}
            className="cyber-button px-5 py-2 rounded-lg"
          >
            前往登录
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] skill-chamber-bg relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <p className="skill-eyebrow mb-2">CURATE</p>
            <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">Skill 管理</h1>
          </div>
          <Link href="/skills" className="text-cyan-400 hover:text-cyan-300">回 Skill 室</Link>
        </div>

        <form onSubmit={submitSkill} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">
              {editingId ? '编辑标本' : '新增标本'}
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
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="例如：新拟物按钮生成器" />
            </div>
            <div>
              <label className="block text-sm mb-2 text-gray-300">分类</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="cyber-input w-full rounded-lg px-3 py-2 mt-2"
                placeholder="或自定义分类键（优先）"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-300">一句话摘要</label>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="这个 Skill 解决什么问题" />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-300">提示词 / Skill 内容</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              className="cyber-input w-full rounded-lg px-3 py-2 font-mono text-sm"
              placeholder="粘贴完整提示词、指令或可复用文本…"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-gray-300">效果图</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading || loading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadEffect(file)
                }}
                className="w-full cyber-input rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-cyan-600 file:text-white"
              />
              <input
                value={effectImageUrl}
                onChange={(e) => setEffectImageUrl(e.target.value)}
                className="cyber-input w-full rounded-lg px-3 py-2 mt-2"
                placeholder="或填写效果图 URL / 路径"
              />
              {effectImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={effectImageUrl} alt="效果预览" className="mt-2 h-24 w-auto rounded-lg border border-cyan-500/20 object-cover" />
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-2 text-gray-300">效果说明</label>
                <input value={effectNote} onChange={(e) => setEffectNote(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="这张图展示了什么结果" />
              </div>
              <div>
                <label className="block text-sm mb-2 text-gray-300">来源 URL</label>
                <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="可选" />
              </div>
              <div>
                <label className="block text-sm mb-2 text-gray-300">标签（逗号分隔）</label>
                <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className="cyber-input w-full rounded-lg px-3 py-2" placeholder="neon, button, cursor" />
              </div>
              <div>
                <label className="block text-sm mb-2 text-gray-300">状态</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as SkillStatus)} className="cyber-input w-full rounded-lg px-3 py-2">
                  <option value="published">已发布</option>
                  <option value="draft">草稿</option>
                  <option value="archived">已归档</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || !canSubmit} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">
            {loading ? '保存中…' : editingId ? '保存修改' : '创建 Skill'}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <section className="cyber-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)] mb-4">已收录 ({skills.length})</h2>
          <div className="space-y-3">
            {skills.map((skill) => (
              <div key={skill.id} className="border border-cyan-500/15 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div>
                  <p className="text-[var(--color-text-strong)] font-medium">{skill.title}</p>
                  <p className="text-xs text-soft mt-1">
                    {SKILL_CATEGORY_LABELS[skill.category] || skill.category} · {skill.status} · /skills/{skill.slug}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Link href={`/skills/${skill.slug}`} className="text-purple-300 hover:text-purple-200">预览</Link>
                  <button type="button" onClick={() => startEditing(skill)} className="text-cyan-400 hover:text-cyan-300">编辑</button>
                  <button type="button" onClick={() => removeSkill(skill)} className="text-red-400 hover:text-red-300">删除</button>
                </div>
              </div>
            ))}
            {skills.length === 0 && <p className="text-soft text-sm">还没有 Skill，用上方表单创建第一份。</p>}
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  )
}
