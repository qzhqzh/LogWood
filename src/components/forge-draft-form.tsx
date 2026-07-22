'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

type DraftKind = 'article' | 'skill'

const SKILL_CATEGORIES = [
  { value: 'workflow', label: '工作流' },
  { value: 'frontend', label: '前端组件' },
  { value: 'style', label: '视觉风格' },
  { value: 'image', label: '图像生成' },
  { value: 'copy', label: '文案提示' },
  { value: 'other', label: '其他' },
] as const

export function ForgeDraftForm() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [kind, setKind] = useState<DraftKind>('article')
  const [category, setCategory] = useState('workflow')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultHref, setResultHref] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) {
      setError('AI 炼成助手的草稿写入仅管理员可用')
      return
    }
    try {
      setLoading(true)
      setError(null)
      setResultHref(null)
      setNote(null)
      const res = await fetch('/api/forge/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          prompt,
          title: title.trim() || undefined,
          category: kind === 'skill' ? category : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '整理失败')
      setResultHref(data.saved?.href || null)
      setNote(data.note || '草稿已保存')
      setPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '整理失败')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="cyber-card rounded-2xl p-6 text-left text-muted text-sm">
        登录管理员账号后，可用本地模板把一句灵感整理成洞笔记或独立 Skill 草稿。当前 Beta 尚未调用真实模型。
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="cyber-card rounded-2xl p-6 text-left space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setKind('article')}
          className={`px-4 py-2 rounded-lg text-sm border ${kind === 'article' ? 'border-pink-400 text-pink-300 bg-pink-500/10' : 'border-divider text-muted'}`}
        >
          洞笔记草稿
        </button>
        <button
          type="button"
          onClick={() => setKind('skill')}
          className={`px-4 py-2 rounded-lg text-sm border ${kind === 'skill' ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10' : 'border-divider text-muted'}`}
        >
          Skill 草稿
        </button>
      </div>

      {kind === 'skill' && (
        <label className="block text-sm text-soft">
          Skill 分类
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]"
          >
            {SKILL_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]"
        placeholder="标题（可选）"
      />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        required
        minLength={8}
        className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]"
        placeholder={kind === 'skill'
          ? '写下要完成的目标、可复用指令或工作流步骤…'
          : '写下灵感、实验记录、踩坑或准备沉淀的结论…'}
      />
      <p className="text-xs text-soft">
        当前只做确定性的本地模板整理，不会自动验证事实、生成测试证据或调用外部模型。
      </p>
      <button type="submit" disabled={loading || prompt.trim().length < 8} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">
        {loading ? '整理中…' : '整理并写入草稿'}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {note && (
        <p className="text-soft text-sm">
          {note}
          {resultHref && (
            <>
              {' '}
              <Link href={resultHref} className="text-cyan-400 hover:text-cyan-300">打开管理页</Link>
            </>
          )}
        </p>
      )}
    </form>
  )
}
