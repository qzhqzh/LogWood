'use client'

import { useMemo, useState } from 'react'

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

interface InlineReviewComposerProps {
  targetId: string
  onSubmitted?: () => void
}

export function InlineReviewComposer({ targetId, onSubmitted }: InlineReviewComposerProps) {
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = useMemo(() => {
    return content.trim().length >= 3
  }, [content])

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    try {
      setStatus('submitting')
      setErrorMessage('')

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId,
          rating,
          content: content.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '发布评测失败')
      }

      setStatus('success')
      setRating(5)
      setContent('')
      onSubmitted?.()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '发布评测失败')
    }
  }

  return (
    <form onSubmit={submitReview} className="mb-6 rounded-xl border border-cyan-500/15 p-4 bg-[#0f1018]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRating(item)}
              className={`w-8 h-8 rounded text-sm transition-colors ${
                item <= rating ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-800 text-gray-500 hover:text-yellow-300'
              }`}
              aria-label={`评分 ${item}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的评测（至少 3 字）"
        className="w-full min-h-[120px] rounded-lg border border-cyan-500/30 bg-[var(--color-surface-1)] px-3 py-2 text-[var(--color-text-strong)]"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">{content.length} / 2000</span>
        <button
          type="submit"
          disabled={!canSubmit || status === 'submitting'}
          className="cyber-button px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {status === 'submitting' ? '发布中...' : '发布评测'}
        </button>
      </div>

      {status === 'success' && <p className="text-xs text-emerald-300 mt-3">发布成功，已刷新评测列表。</p>}
      {status === 'error' && <p className="text-xs text-red-300 mt-3">{errorMessage}</p>}
    </form>
  )
}
