'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { AiAttribution } from '@/components/ai-attribution'

interface ArticleCommentItem {
  id: string
  parentId: string | null
  content: string
  createdAt: string
  aiProvider?: string | null
  aiModel?: string | null
  aiModelVersion?: string | null
  aiGeneratedAt?: string | null
  aiAgentId?: string | null
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
}

interface ArticleCommentNode extends ArticleCommentItem {
  replies: ArticleCommentNode[]
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

function buildCommentTree(comments: ArticleCommentItem[]): ArticleCommentNode[] {
  const nodes = new Map<string, ArticleCommentNode>()
  comments.forEach((comment) => nodes.set(comment.id, { ...comment, replies: [] }))
  const roots: ArticleCommentNode[] = []
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.replies.push(node)
    else roots.push(node)
  })
  const sortReplies = (items: ArticleCommentNode[]) => {
    items.sort((left, right) => (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    ))
    items.forEach((item) => sortReplies(item.replies))
  }
  roots.sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ))
  roots.forEach((root) => sortReplies(root.replies))
  return roots
}

export function ArticleEngagement({ articleId, initialCommentCount = 0 }: ArticleEngagementProps) {
  const [likesCount, setLikesCount] = useState(0)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [isLikedByMe, setIsLikedByMe] = useState(false)
  const [comments, setComments] = useState<ArticleCommentItem[]>([])
  const [commentContent, setCommentContent] = useState('')
  const [replyTarget, setReplyTarget] = useState<ArticleCommentItem | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingComments, setLoadingComments] = useState(true)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [togglingLike, setTogglingLike] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const commentFormRef = useRef<HTMLFormElement>(null)

  const canSubmit = useMemo(() => commentContent.trim().length > 0, [commentContent])
  const commentTree = useMemo(() => buildCommentTree(comments), [comments])

  function selectReplyTarget(item: ArticleCommentItem) {
    setReplyTarget(item)
    requestAnimationFrame(() => {
      commentFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

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
      const res = await fetch(`/api/articles/${articleId}/comments?pageSize=100`, { cache: 'no-store' })
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
          parentId: replyTarget?.id,
          content: commentContent.trim(),
          deviceFingerprint: getFingerprint(),
        }),
      })
      const data = await safeReadJson<{ error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || '评论发布失败')
      }

      setCommentContent('')
      setReplyTarget(null)
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
          <h3 className="text-xl font-semibold text-[var(--color-text-strong)]">点赞与评论</h3>
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

      <form ref={commentFormRef} onSubmit={submitComment} className="mb-6">
        {replyTarget && (
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-cyan-200">
            <span>回复 {replyTarget.author.name}</span>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              className="text-gray-400 hover:text-gray-200"
            >
              取消
            </button>
          </div>
        )}
        <textarea
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="写下你的评论"
          className="w-full min-h-[96px] rounded-lg border border-cyan-500/30 bg-[var(--color-surface-1)] px-3 py-2 text-[var(--color-text-strong)]"
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
          commentTree.map((item) => (
            <ArticleCommentThread
              key={item.id}
              item={item}
              depth={0}
              onReply={selectReplyTarget}
            />
          ))
        )}
      </div>
    </section>
  )
}

function ArticleCommentThread({
  item,
  depth,
  onReply,
}: {
  item: ArticleCommentNode
  depth: number
  onReply: (item: ArticleCommentItem) => void
}) {
  return (
    <div className={depth === 0
      ? 'rounded-lg border border-cyan-500/15 bg-[#10131c] p-3'
      : 'ml-3 border-l border-cyan-500/20 pl-3 pt-3 sm:ml-6'
    }>
      <div className="flex flex-wrap items-center gap-2 mb-1 text-sm">
        <span className="text-cyan-200 font-medium">{item.author.name}</span>
        {item.aiAgentId && (
          <span className="text-xs text-emerald-300">{item.aiAgentId}</span>
        )}
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(item.createdAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </span>
      </div>
      <AiAttribution
        provider={item.aiProvider}
        model={item.aiModel}
        modelVersion={item.aiModelVersion}
        generatedAt={item.aiGeneratedAt}
        className="mb-1"
      />
      <p className="text-sm text-gray-200 whitespace-pre-wrap break-all">{item.content}</p>
      <button
        type="button"
        onClick={() => onReply(item)}
        className="mt-2 text-xs text-gray-500 hover:text-cyan-200"
      >
        回复
      </button>
      {item.replies.map((reply) => (
        <ArticleCommentThread
          key={reply.id}
          item={reply}
          depth={Math.min(depth + 1, 3)}
          onReply={onReply}
        />
      ))}
    </div>
  )
}
