'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Review {
  id: string
  targetId: string
  category: string
  content: string
  rating: number
  likesCount: number
  createdAt: string
  author: {
    type: 'user' | 'anonymous'
    name: string
    avatarUrl?: string | null
  }
  target?: {
    id: string
    name: string
    slug: string
    type: string
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

interface LikeStats {
  total: number
  userCount: number
  anonymousCount: number
}

function ReviewDetailContent() {
  const searchParams = useSearchParams()
  const reviewId = searchParams.get('id')

  const [review, setReview] = useState<Review | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [likeStats, setLikeStats] = useState<LikeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    if (!reviewId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const [reviewRes, commentsRes, likeRes] = await Promise.all([
          fetch(`/api/reviews/${reviewId}`),
          fetch(`/api/comments?reviewId=${reviewId}`),
          fetch(`/api/reviews/${reviewId}/like?list=true`),
        ])

        const reviewData = await reviewRes.json()
        const commentsData = await commentsRes.json()
        const likeData = await likeRes.json()

        setReview(reviewData.review)
        setComments(commentsData.comments || [])
        setLikeStats(likeData.stats)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [reviewId])

  const handleLike = async () => {
    if (!review) return
    try {
      const res = await fetch(`/api/reviews/${review.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      
      if (data.liked) {
        setReview({ ...review, likesCount: data.likesCount, isLikedByMe: true })
        setLikeStats(prev => prev ? { ...prev, total: prev.total + (data.isNew ? 1 : 0) } : null)
      }
    } catch (error) {
      console.error('Failed to like review:', error)
    }
  }

  const handleCommentLike = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      
      if (data.liked) {
        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, likesCount: data.likesCount, isLikedByMe: true }
            : c
        ))
      }
    } catch (error) {
      console.error('Failed to like comment:', error)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!review || !commentText.trim()) return

    setSubmittingComment(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: review.id,
          content: commentText.trim(),
        }),
      })

      if (res.ok) {
        setCommentText('')
        const commentsRes = await fetch(`/api/comments?reviewId=${review.id}`)
        const commentsData = await commentsRes.json()
        setComments(commentsData.comments || [])
      }
    } catch (error) {
      console.error('Failed to submit comment:', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>
  }

  if (!review) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">评测不存在或已被删除</p>
        <Link href="/" className="text-cyan-400 hover:underline mt-4 inline-block">
          返回首页
        </Link>
      </div>
    )
  }

  const targetPath = review.target?.type === 'editor' ? 'editor' : 'coding'

  return (
    <div className="space-y-8">
      <div className="cyber-card rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-xl">
              {review.author.type === 'anonymous' ? '🎭' : '👤'}
            </div>
            <div>
              <div className="font-medium text-white">{review.author.name}</div>
              <div className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(review.createdAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-2xl">
            <span className="text-yellow-400">★</span>
            <span className="font-bold text-white">{review.rating}</span>
          </div>
        </div>

        {review.target && (
          <Link
            href={`/${targetPath}/${review.target.slug}`}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            {review.target.name}
          </Link>
        )}

        <div className="mb-4">
          <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-sm">
            {review.category}
          </span>
        </div>

        <p className="text-gray-300 whitespace-pre-wrap text-lg leading-relaxed">
          {review.content}
        </p>

        <div className="mt-6 pt-6 border-t border-cyan-500/10">
          <div className="flex items-center gap-6">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                review.isLikedByMe
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-cyan-400 hover:bg-gray-700'
              }`}
            >
              👍 点赞 {review.likesCount}
            </button>
            
            {likeStats && (
              <div className="text-sm text-gray-500">
                <span className="text-cyan-400">{likeStats.userCount}</span> 登录用户 ·{' '}
                <span className="text-purple-400">{likeStats.anonymousCount}</span> 匿名用户
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cyber-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold font-['Orbitron'] text-white mb-4">
          评论 ({comments.length})
        </h2>

        <form onSubmit={handleSubmitComment} className="mb-6">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="写下你的评论..."
            className="w-full px-4 py-3 cyber-input rounded-xl min-h-[100px]"
            minLength={10}
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-sm text-gray-500">
              {commentText.length} / 500 字
            </span>
            <button
              type="submit"
              disabled={submittingComment || commentText.length < 10}
              className="cyber-button px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingComment ? '提交中...' : '发表评论'}
            </button>
          </div>
        </form>

        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">暂无评论</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="border border-cyan-500/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/50 to-purple-500/50 flex items-center justify-center text-sm">
                    {comment.author.type === 'anonymous' ? '🎭' : '👤'}
                  </div>
                  <span className="font-medium text-white">{comment.author.name}</span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>
                <p className="text-gray-300">{comment.content}</p>
                <button
                  onClick={() => handleCommentLike(comment.id)}
                  className={`mt-2 text-sm ${
                    comment.isLikedByMe
                      ? 'text-cyan-400'
                      : 'text-gray-500 hover:text-cyan-400'
                  }`}
                >
                  👍 {comment.likesCount}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReviewDetailPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <nav className="border-b border-cyan-500/20 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">LW</span>
              </div>
              <span className="text-2xl font-bold font-['Orbitron'] gradient-text">LogWood</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/editor" className="text-gray-400 hover:text-cyan-400 transition-colors font-medium tracking-wide">
                AI Editor
              </Link>
              <Link href="/coding" className="text-gray-400 hover:text-purple-400 transition-colors font-medium tracking-wide">
                AI Coding
              </Link>
              <Link href="/submit" className="cyber-button px-5 py-2 rounded-lg font-semibold tracking-wide">
                发布评测
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <Suspense fallback={<div className="text-center py-12 text-gray-500">加载中...</div>}>
          <ReviewDetailContent />
        </Suspense>
      </div>
    </main>
  )
}
