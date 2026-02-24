'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Review {
  id: string
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
  isLikedByMe?: boolean
}

interface ReviewListProps {
  targetId: string
}

export function ReviewList({ targetId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
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
      
      if (data.liked) {
        setReviews(reviews.map(r => 
          r.id === reviewId 
            ? { ...r, likesCount: data.likesCount, isLikedByMe: true }
            : r
        ))
      }
    } catch (error) {
      console.error('Failed to like review:', error)
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
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          最新
        </button>
        <button
          onClick={() => setSort('hot')}
          className={`px-3 py-1 rounded-lg text-sm ${
            sort === 'hot'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          最热
        </button>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                  {review.author.type === 'anonymous' ? '🎭' : '👤'}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{review.author.name}</div>
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

            <div className="mb-2">
              <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                {review.category}
              </span>
            </div>

            <p className="text-gray-700 whitespace-pre-wrap">{review.content}</p>

            <div className="flex items-center gap-4 mt-3 pt-3 border-t">
              <button
                onClick={() => handleLike(review.id)}
                className={`flex items-center gap-1 text-sm ${
                  review.isLikedByMe
                    ? 'text-primary-600'
                    : 'text-gray-500 hover:text-primary-600'
                }`}
              >
                👍 {review.likesCount}
              </button>
              <Link
                href={`/review?id=${review.id}`}
                className="text-sm text-gray-500 hover:text-primary-600"
              >
                查看详情
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
