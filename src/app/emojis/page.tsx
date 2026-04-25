'use client'

import { useCallback, useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { SiteFooter } from '@/components/site-footer'

interface EmojiItem {
  id: string
  name: string
  symbol: string
}

export default function EmojisPage() {
  const { status } = useSession()
  const [emojis, setEmojis] = useState<EmojiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAuthed = status === 'authenticated'

  const loadEmojis = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/emojis', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '加载表情失败')
      }
      setEmojis(data.emojis || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载表情失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEmojis().catch(() => undefined)
  }, [loadEmojis])

  async function createEmoji() {
    if (!isAuthed || !name.trim() || !symbol.trim()) return

    try {
      setSubmitting(true)
      setError(null)
      const res = await fetch('/api/emojis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), symbol: symbol.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '创建失败')
      }

      setName('')
      setSymbol('')
      await loadEmojis()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function removeEmoji(id: string) {
    if (!isAuthed) return

    try {
      setDeletingId(id)
      setError(null)
      const res = await fetch(`/api/emojis/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '删除失败')
      }

      setEmojis((prev) => prev.filter((item) => item.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <div className="inline-block mb-4 px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-500/5">
            <span className="text-cyan-400 text-sm tracking-widest uppercase">GLOBAL EMOJI POOL</span>
          </div>
          <h1 className="text-4xl font-bold font-['Orbitron'] gradient-text mb-4">表情包管理</h1>
          <p className="text-gray-400 max-w-3xl">表情为全站通用，可用于评测和评论输入。</p>
        </div>

        <div className="cyber-card rounded-2xl p-5 mb-6">
          {isAuthed ? (
            <div className="flex flex-col md:flex-row gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]"
                placeholder="表情名称，如 加油"
              />
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-[var(--color-surface-1)] border border-cyan-500/30 rounded-lg px-3 py-2 text-[var(--color-text-strong)]"
                placeholder="表情字符，如 🚀"
              />
              <button
                type="button"
                onClick={createEmoji}
                disabled={submitting}
                className="cyber-button px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {submitting ? '新增中...' : '新增表情'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => signIn(undefined, { callbackUrl: '/emojis' })}
              className="cyber-button px-4 py-2 rounded-lg"
            >
              登录后管理表情
            </button>
          )}
        </div>

        {loading ? (
          <div className="cyber-card rounded-2xl p-6 text-gray-400">表情加载中...</div>
        ) : (
          <div className="cyber-card rounded-2xl p-5">
            <div className="flex flex-wrap gap-2.5">
              {emojis.map((item) => (
                <div key={item.id} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 px-3 py-1.5 text-sm text-gray-200">
                  <span>{item.symbol}</span>
                  <span>{item.name}</span>
                  {isAuthed && (
                    <button
                      type="button"
                      onClick={() => removeEmoji(item.id)}
                      disabled={deletingId === item.id}
                      className="text-gray-400 hover:text-red-300 disabled:opacity-60"
                      aria-label={`删除表情 ${item.name}`}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
              {emojis.length === 0 && <p className="text-sm text-gray-500">暂无表情，先添加一个。</p>}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
      <SiteFooter />
    </main>
  )
}
