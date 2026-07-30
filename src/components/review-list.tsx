'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { ReviewSubjectType } from '@/modules/review/constants'
import { REVIEW_SUBJECT_QUERY_KEY } from '@/modules/review/constants'
import { AiAttribution } from '@/components/ai-attribution'

interface Review {
  id: string
  content: string
  rating: number
  commentCount: number
  likesCount: number
  createdAt: string
  aiProvider?: string | null
  aiModel?: string | null
  aiModelVersion?: string | null
  aiGeneratedAt?: string | null
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
  isLikedByMe?: boolean
}

interface Comment {
  id: string
  parentId: string | null
  content: string
  likesCount: number
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
  isLikedByMe?: boolean
}

interface CommentNode extends Comment {
  replies: CommentNode[]
}

interface ReviewListProps {
  subjectType?: ReviewSubjectType
  subjectId?: string
  /** @deprecated use subjectType/subjectId */
  targetId?: string
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

function buildCommentTree(comments: Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  comments.forEach((comment) => nodes.set(comment.id, { ...comment, replies: [] }))
  const roots: CommentNode[] = []
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.replies.push(node)
    else roots.push(node)
  })
  const sortReplies = (items: CommentNode[]) => {
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

export function ReviewList({
  subjectType: subjectTypeProp,
  subjectId: subjectIdProp,
  targetId,
}: ReviewListProps) {
  const subjectType = subjectTypeProp || 'target'
  const subjectId = subjectIdProp || targetId || ''
  const [reviews, setReviews] = useState<Review[]>([])
  const [commentsByReviewId, setCommentsByReviewId] = useState<Record<string, Comment[]>>({})
  const [loadingCommentsByReviewId, setLoadingCommentsByReviewId] = useState<Record<string, boolean>>({})
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [draftsByReviewId, setDraftsByReviewId] = useState<Record<string, string>>({})
  const [replyTargetsByReviewId, setReplyTargetsByReviewId] = useState<Record<string, Comment | null>>({})
  const [submittingByReviewId, setSubmittingByReviewId] = useState<Record<string, boolean>>({})
  const [commentErrorsByReviewId, setCommentErrorsByReviewId] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'latest' | 'hot'>('latest')

  useEffect(() => {
    if (!subjectId) return
    const fetchReviews = async () => {
      setLoading(true)
      try {
        const key = REVIEW_SUBJECT_QUERY_KEY[subjectType]
        const res = await fetch(`/api/reviews?${key}=${encodeURIComponent(subjectId)}&sort=${sort}`)
        const data = await res.json()
        setReviews(data.reviews || [])
      } catch (error) {
        console.error('Failed to fetch reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [subjectType, subjectId, sort])

  const handleLike = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/reviews/${reviewId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      
      setReviews(reviews.map(r => 
        r.id === reviewId 
          ? { ...r, likesCount: data.likesCount, isLikedByMe: Boolean(data.liked) }
          : r
      ))
    } catch (error) {
      console.error('Failed to like review:', error)
    }
  }

  const handleCommentLike = async (reviewId: string, commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      setCommentsByReviewId((prev) => ({
        ...prev,
        [reviewId]: (prev[reviewId] || []).map((comment) =>
          comment.id === commentId
            ? { ...comment, likesCount: data.likesCount, isLikedByMe: Boolean(data.liked) }
            : comment
        ),
      }))
    } catch (error) {
      console.error('Failed to like comment:', error)
    }
  }

  const toggleReviewExpanded = (reviewId: string) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }))
  }

  const loadReviewComments = async (reviewId: string) => {
    setLoadingCommentsByReviewId((prev) => ({ ...prev, [reviewId]: true }))
    try {
      const res = await fetch(`/api/comments?reviewId=${reviewId}&pageSize=100`)
      const data = await res.json()
      setCommentsByReviewId((prev) => ({
        ...prev,
        [reviewId]: data.comments || [],
      }))
    } catch (error) {
      console.error('Failed to fetch comments:', error)
      setCommentsByReviewId((prev) => ({
        ...prev,
        [reviewId]: [],
      }))
    } finally {
      setLoadingCommentsByReviewId((prev) => ({ ...prev, [reviewId]: false }))
    }
  }

  const toggleReplies = async (reviewId: string) => {
    const willExpand = !expandedReplies[reviewId]
    setExpandedReplies((prev) => ({ ...prev, [reviewId]: willExpand }))
    if (willExpand && !commentsByReviewId[reviewId]) {
      await loadReviewComments(reviewId)
    }
  }

  const submitComment = async (reviewId: string) => {
    const content = (draftsByReviewId[reviewId] || '').trim()
    if (content.length < 10 || content.length > 500) return
    setSubmittingByReviewId((prev) => ({ ...prev, [reviewId]: true }))
    setCommentErrorsByReviewId((prev) => ({ ...prev, [reviewId]: null }))
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          parentId: replyTargetsByReviewId[reviewId]?.id,
          content,
          deviceFingerprint: getFingerprint(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '回复发布失败')
      setDraftsByReviewId((prev) => ({ ...prev, [reviewId]: '' }))
      setReplyTargetsByReviewId((prev) => ({ ...prev, [reviewId]: null }))
      setReviews((prev) => prev.map((review) => (
        review.id === reviewId
          ? { ...review, commentCount: review.commentCount + 1 }
          : review
      )))
      await loadReviewComments(reviewId)
    } catch (error) {
      setCommentErrorsByReviewId((prev) => ({
        ...prev,
        [reviewId]: error instanceof Error ? error.message : '回复发布失败',
      }))
    } finally {
      setSubmittingByReviewId((prev) => ({ ...prev, [reviewId]: false }))
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted">加载中...</div>
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        暂无评测，成为第一个发布评测的人吧！
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSort('latest')}
          className={`px-3 py-1 rounded-lg text-sm ${
            sort === 'latest'
              ? 'status-info border'
              : 'bg-[var(--color-surface-2)] text-muted hover-text-coding border border-transparent'
          }`}
        >
          最新
        </button>
        <button
          onClick={() => setSort('hot')}
          className={`px-3 py-1 rounded-lg text-sm ${
            sort === 'hot'
              ? 'status-info border'
              : 'bg-[var(--color-surface-2)] text-muted hover-text-coding border border-transparent'
          }`}
        >
          最热
        </button>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => {
          const canToggleContent = review.content.trim().length > 120

          return (
            <div key={review.id} className="rounded-xl border border-divider p-4 surface-panel">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-divider flex items-center justify-center text-sm">
                  {review.author.type === 'anonymous' ? '🎭' : '👤'}
                </div>
                <div>
                  <div className="font-medium text-coding">{review.author.name}</div>
                  <div className="text-xs text-soft">
                    {formatDistanceToNow(new Date(review.createdAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-yellow-500">★</span>
                <span className="font-medium">{review.rating}</span>
              </div>
            </div>
            <AiAttribution
              provider={review.aiProvider}
              model={review.aiModel}
              modelVersion={review.aiModelVersion}
              generatedAt={review.aiGeneratedAt}
              className="mb-2"
            />
            <p
              className={`text-muted whitespace-pre-wrap break-all ${
                expandedReviews[review.id] || !canToggleContent ? '' : 'line-clamp-3'
              }`}
            >
              {review.content}
            </p>

            {canToggleContent && (
              <div className="mt-2">
                <button
                  onClick={() => toggleReviewExpanded(review.id)}
                  className="text-sm text-soft hover-text-coding"
                >
                  {expandedReviews[review.id] ? '收起' : '展开全文'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-divider">
              <button
                onClick={() => handleLike(review.id)}
                className={`flex items-center gap-1 text-sm ${
                  review.isLikedByMe
                    ? 'text-coding'
                    : 'text-soft hover-text-coding'
                }`}
              >
                👍 {review.likesCount}
              </button>

              <button
                onClick={() => toggleReplies(review.id)}
                className="text-sm text-soft hover-text-coding"
              >
                {expandedReplies[review.id] ? '收起回复' : `回复(${review.commentCount})`}
              </button>
            </div>

            {expandedReplies[review.id] && (
              <div className="mt-4 rounded-xl border border-divider surface-panel p-3 space-y-3">
                <div>
                  {replyTargetsByReviewId[review.id] && (
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-coding">
                      <span>回复 {replyTargetsByReviewId[review.id]?.author.name}</span>
                      <button
                        type="button"
                        onClick={() => setReplyTargetsByReviewId((prev) => ({
                          ...prev,
                          [review.id]: null,
                        }))}
                        className="text-soft hover-text-coding"
                      >
                        取消
                      </button>
                    </div>
                  )}
                  <textarea
                    value={draftsByReviewId[review.id] || ''}
                    onChange={(event) => setDraftsByReviewId((prev) => ({
                      ...prev,
                      [review.id]: event.target.value,
                    }))}
                    maxLength={500}
                    placeholder="写下回复"
                    className="min-h-[76px] w-full rounded-lg border border-divider bg-[var(--color-surface-1)] px-3 py-2 text-sm text-[var(--color-text-strong)]"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-soft">
                      {(draftsByReviewId[review.id] || '').length} / 500
                    </span>
                    <button
                      type="button"
                      onClick={() => submitComment(review.id)}
                      disabled={
                        (draftsByReviewId[review.id] || '').trim().length < 10
                        || submittingByReviewId[review.id]
                      }
                      className="cyber-button rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {submittingByReviewId[review.id] ? '发布中...' : '发布回复'}
                    </button>
                  </div>
                  {commentErrorsByReviewId[review.id] && (
                    <p className="mt-2 text-xs text-red-300">
                      {commentErrorsByReviewId[review.id]}
                    </p>
                  )}
                </div>
                {loadingCommentsByReviewId[review.id] ? (
                  <p className="text-sm text-soft">回复加载中...</p>
                ) : (commentsByReviewId[review.id] || []).length === 0 ? (
                  <p className="text-sm text-soft">暂无回复</p>
                ) : (
                  buildCommentTree(commentsByReviewId[review.id] || []).map((comment) => (
                    <ReviewCommentThread
                      key={comment.id}
                      reviewId={review.id}
                      comment={comment}
                      depth={0}
                      onLike={handleCommentLike}
                      onReply={(target) => setReplyTargetsByReviewId((prev) => ({
                        ...prev,
                        [review.id]: target,
                      }))}
                    />
                  ))
                )}
              </div>
            )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReviewCommentThread({
  reviewId,
  comment,
  depth,
  onLike,
  onReply,
}: {
  reviewId: string
  comment: CommentNode
  depth: number
  onLike: (reviewId: string, commentId: string) => Promise<void>
  onReply: (comment: Comment) => void
}) {
  return (
    <div className={depth === 0
      ? 'rounded-lg border border-divider bg-[var(--color-surface-1)] p-3'
      : 'ml-3 border-l border-divider pl-3 pt-3 sm:ml-6'
    }>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <div className="text-sm font-semibold text-coding">{comment.author.name}</div>
        {comment.aiAgentId && (
          <span className="text-xs text-emerald-300">{comment.aiAgentId}</span>
        )}
        <div className="text-xs text-soft">
          {formatDistanceToNow(new Date(comment.createdAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </div>
      </div>
      <AiAttribution
        provider={comment.aiProvider}
        model={comment.aiModel}
        modelVersion={comment.aiModelVersion}
        generatedAt={comment.aiGeneratedAt}
        className="mb-1"
      />
      <p className="text-sm text-muted whitespace-pre-wrap break-all">{comment.content}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onLike(reviewId, comment.id)}
          className={`text-xs ${
            comment.isLikedByMe
              ? 'text-coding'
              : 'text-soft hover-text-coding'
          }`}
        >
          👍 {comment.likesCount}
        </button>
        <button
          type="button"
          onClick={() => onReply(comment)}
          className="text-xs text-soft hover-text-coding"
        >
          回复
        </button>
      </div>
      {comment.replies.map((reply) => (
        <ReviewCommentThread
          key={reply.id}
          reviewId={reviewId}
          comment={reply}
          depth={Math.min(depth + 1, 3)}
          onLike={onLike}
          onReply={onReply}
        />
      ))}
    </div>
  )
}
