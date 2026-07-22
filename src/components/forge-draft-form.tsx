'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

type DraftKind = 'article' | 'skill'

export function ForgeDraftForm() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [kind, setKind] = useState<DraftKind>('article')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultHref, setResultHref] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) {
      setError('造物台草稿写入仅管理员可用')
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
          type: kind === 'skill' ? 'prompt' : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失败')
      setResultHref(data.saved?.href || null)
      setNote(data.note || '草稿已保存')
      setPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="cyber-card rounded-2xl p-6 text-left text-muted text-sm">
        登录管理员账号后，可在此把一句话投喂成洞笔记草稿或 Skill 条目（当前为本地模板，预留模型接入）。
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="cyber-card rounded-2xl p-6 text-left space-y-4">
      <div className="flex gap-3">
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
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]"
        placeholder="标题（可选）"
      />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={5}
        required
        minLength={8}
        className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]"
        placeholder="投喂一段灵感、Skill 说明或想收藏的理由…"
      />
      <button type="submit" disabled={loading || prompt.trim().length < 8} className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60">
        {loading ? '生长中…' : '生成并写入草稿'}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {note && (
        <p className="text-soft text-sm">
          {note}
          {resultHref && (
            <>
              {' '}
              <Link href={resultHref} className="text-cyan-400 hover:text-cyan-300">打开</Link>
            </>
          )}
        </p>
      )}
    </form>
  )
}
