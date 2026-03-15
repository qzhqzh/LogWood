'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Review {
  id: string
  content: string
  rating: number
  commentCount: number
  likesCount: number
  createdAt: string
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
  isLikedByMe?: boolean
}

interface Comment {
  id: string
  content: string
  likesCount: number
  createdAt: string
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
  isLikedByMe?: boolean
}

interface ReviewListProps {
  targetId: string
}

export function ReviewList({ targetId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [commentsByReviewId, setCommentsByReviewId] = useState<Record<string, Comment[]>>({})
  const [loadingCommentsByReviewId, setLoadingCommentsByReviewId] = useState<Record<string, boolean>>({})
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'latest' | 'hot'>('latest')

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/reviews?targetId=${targetId}&sort=${sort}`)
        const data = await res.json()
        setReviews(data.reviews || [])
      } catch (error) {
        console.error('Failed to fetch reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [targetId, sort])

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

  const toggleReplies = async (reviewId: string) => {
    const willExpand = !expandedReplies[reviewId]
    setExpandedReplies((prev) => ({ ...prev, [reviewId]: willExpand }))

    if (!willExpand || commentsByReviewId[reviewId]) {
      return
    }

    setLoadingCommentsByReviewId((prev) => ({ ...prev, [reviewId]: true }))
    try {
      const res = await fetch(`/api/comments?reviewId=${reviewId}`)
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

  if (loading) {
    return <div className="text-center py-8 text-gray-500">加载中...</div>
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
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
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'bg-gray-800 text-gray-400 hover:text-cyan-300 hover:bg-gray-700 border border-transparent'
          }`}
        >
          最新
        </button>
        <button
          onClick={() => setSort('hot')}
          className={`px-3 py-1 rounded-lg text-sm ${
            sort === 'hot'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'bg-gray-800 text-gray-400 hover:text-cyan-300 hover:bg-gray-700 border border-transparent'
          }`}
        >
          最热
        </button>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => {
          const canToggleContent = review.content.trim().length > 120

          return (
            <div key={review.id} className="rounded-xl border border-cyan-500/15 p-4 bg-[#0f1018]">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/30 flex items-center justify-center text-sm">
                  {review.author.type === 'anonymous' ? '🎭' : '👤'}
                </div>
                <div>
                  <div className="font-medium text-cyan-200">{review.author.name}</div>
                  <div className="text-xs text-gray-500">
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
            <p
              className={`text-gray-300 whitespace-pre-wrap break-all ${
                expandedReviews[review.id] || !canToggleContent ? '' : 'line-clamp-3'
              }`}
            >
              {review.content}
            </p>

            {canToggleContent && (
              <div className="mt-2">
                <button
                  onClick={() => toggleReviewExpanded(review.id)}
                  className="text-sm text-gray-500 hover:text-cyan-400"
                >
                  {expandedReviews[review.id] ? '收起' : '展开全文'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-cyan-500/10">
              <button
                onClick={() => handleLike(review.id)}
                className={`flex items-center gap-1 text-sm ${
                  review.isLikedByMe
                    ? 'text-cyan-400'
                    : 'text-gray-500 hover:text-cyan-400'
                }`}
              >
                👍 {review.likesCount}
              </button>

              <button
                onClick={() => toggleReplies(review.id)}
                className="text-sm text-gray-500 hover:text-cyan-400"
              >
                {expandedReplies[review.id] ? '收起回复' : `回复(${review.commentCount})`}
              </button>
            </div>

            {expandedReplies[review.id] && (
              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-[#0f1018] p-3 space-y-3">
                {loadingCommentsByReviewId[review.id] ? (
                  <p className="text-sm text-gray-500">回复加载中...</p>
                ) : (commentsByReviewId[review.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-500">暂无回复</p>
                ) : (
                  (commentsByReviewId[review.id] || []).map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-cyan-500/15 bg-[#12121a] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/30 flex items-center justify-center text-xs">
                          {comment.author.type === 'anonymous' ? '🎭' : '👤'}
                        </div>
                        <div className="text-sm font-semibold text-cyan-200">{comment.author.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(comment.createdAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap break-all">{comment.content}</p>
                      <button
                        onClick={() => handleCommentLike(review.id, comment.id)}
                        className={`mt-2 text-xs ${
                          comment.isLikedByMe
                            ? 'text-cyan-400'
                            : 'text-gray-500 hover:text-cyan-400'
                        }`}
                      >
                        👍 {comment.likesCount}
                      </button>
                    </div>
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
