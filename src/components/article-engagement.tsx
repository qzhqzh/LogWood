'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface ArticleCommentItem {
  id: string
  content: string
  createdAt: string
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
}

interface ArticleEngagementProps {
  articleId: string
  initialCommentCount?: number
}

function getFingerprint(): string {
  if (typeof window === 'undefined') return ''

  const key = 'logwood_device_fingerprint'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const generated = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, generated)
  return generated
}

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function ArticleEngagement({ articleId, initialCommentCount = 0 }: ArticleEngagementProps) {
  const [likesCount, setLikesCount] = useState(0)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [isLikedByMe, setIsLikedByMe] = useState(false)
  const [comments, setComments] = useState<ArticleCommentItem[]>([])
  const [commentContent, setCommentContent] = useState('')
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingComments, setLoadingComments] = useState(true)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [togglingLike, setTogglingLike] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => commentContent.trim().length > 0, [commentContent])

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const fingerprint = encodeURIComponent(getFingerprint())
      const res = await fetch(`/api/articles/${articleId}/like?fingerprint=${fingerprint}`, { cache: 'no-store' })
      const data = await safeReadJson<{ stats?: { likesCount: number; commentCount: number; isLikedByMe: boolean }; error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || '加载互动数据失败')
      }

      const stats = data?.stats
      setLikesCount(stats?.likesCount || 0)
      setCommentCount(stats?.commentCount ?? initialCommentCount)
      setIsLikedByMe(Boolean(stats?.isLikedByMe))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载互动数据失败')
    } finally {
      setLoadingStats(false)
    }
  }, [articleId, initialCommentCount])

  const loadComments = useCallback(async () => {
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, { cache: 'no-store' })
      const data = await safeReadJson<{ comments?: ArticleCommentItem[]; total?: number; error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || '加载评论失败')
      }

      setComments(data?.comments || [])
      setCommentCount(data?.total ?? data?.comments?.length ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载评论失败')
    } finally {
      setLoadingComments(false)
    }
  }, [articleId])

  useEffect(() => {
    loadStats().catch(() => undefined)
    loadComments().catch(() => undefined)
  }, [loadComments, loadStats])

  async function toggleLike() {
    try {
      setTogglingLike(true)
      setError(null)
      const res = await fetch(`/api/articles/${articleId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint: getFingerprint(),
        }),
      })
      const data = await safeReadJson<{ liked?: boolean; likesCount?: number; error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || '点赞失败')
      }

      setIsLikedByMe(Boolean(data?.liked))
      setLikesCount(data?.likesCount || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '点赞失败')
    } finally {
      setTogglingLike(false)
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    try {
      setSubmittingComment(true)
      setError(null)
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentContent.trim(),
          deviceFingerprint: getFingerprint(),
        }),
      })
      const data = await safeReadJson<{ error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || '评论发布失败')
      }

      setCommentContent('')
      await Promise.all([loadComments(), loadStats()])
    } catch (e) {
      setError(e instanceof Error ? e.message : '评论发布失败')
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
    <section className="mt-8 cyber-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-xl font-semibold text-white">点赞与评论</h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={toggleLike}
            disabled={togglingLike || loadingStats}
            className={`px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
              isLikedByMe
                ? 'border-pink-400/60 bg-pink-500/15 text-pink-300'
                : 'border-cyan-500/30 text-cyan-300 hover:border-cyan-400/50 hover:text-cyan-200'
            }`}
          >
            👍 {loadingStats ? '...' : likesCount}
          </button>
          <span className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-300">💬 {commentCount}</span>
        </div>
      </div>

      <form onSubmit={submitComment} className="mb-6">
        <textarea
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="写下你的评论"
          className="w-full min-h-[96px] rounded-lg border border-cyan-500/30 bg-[#12121a] px-3 py-2 text-white"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{commentContent.length} / 500</span>
          <button
            type="submit"
            disabled={!canSubmit || submittingComment}
            className="cyber-button px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {submittingComment ? '发布中...' : '发布评论'}
          </button>
        </div>
      </form>

      {error && <p className="text-red-300 text-sm mb-3">{error}</p>}

      <div className="space-y-3">
        {loadingComments ? (
          <p className="text-sm text-gray-500">评论加载中...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500">暂无评论，欢迎发布第一条评论。</p>
        ) : (
          comments.map((item) => (
            <div key={item.id} className="rounded-lg border border-cyan-500/15 bg-[#10131c] p-3">
              <div className="flex items-center gap-2 mb-1 text-sm">
                <span className="text-cyan-200 font-medium">{item.author.name}</span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-all">{item.content}</p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
