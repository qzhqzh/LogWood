'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { SiteFooter } from '@/components/site-footer'

type CommentStatus = 'published' | 'pending' | 'hidden'

interface ManagedComment {
  id: string
  content: string
  status: CommentStatus
  createdAt: string
  likesCount: number
  authorName: string
  review: {
    id: string
    content: string
    target: {
      id: string
      name: string
      slug: string
      type: string
    }
  }
}

interface ManageResponse {
  comments: ManagedComment[]
  total: number
  page: number
  pageSize: number
}

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const raw = await res.text()
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export default function ManageCommentsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [comments, setComments] = useState<ManagedComment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('active')
  const [keyword, setKeyword] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const isAdmin = session?.user?.role === 'admin'

  const loadComments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (keyword.trim()) {
        params.set('q', keyword.trim())
      }
      const res = await fetch(`/api/comments/manage?${params.toString()}`, { cache: 'no-store' })
      const data = await safeReadJson<ManageResponse & { error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || `加载评论失败（${res.status}）`)
      }
      setComments(data?.comments || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载评论失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, keyword])

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !isAdmin) return
    loadComments().catch(() => undefined)
  }, [sessionStatus, isAdmin, loadComments])

  async function updateStatus(id: string, action: 'hide' | 'publish') {
    try {
      setProcessingId(id)
      setError(null)
      const res = await fetch(`/api/comments/manage/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await safeReadJson<{ error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || `更新评论失败（${res.status}）`)
      }
      await loadComments()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新评论失败')
    } finally {
      setProcessingId(null)
    }
  }

  async function removeComment(id: string) {
    try {
      setProcessingId(id)
      setError(null)
      const res = await fetch(`/api/comments/manage/${id}`, { method: 'DELETE' })
      const data = await safeReadJson<{ error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || `删除评论失败（${res.status}）`)
      }
      setComments((prev) => prev.filter((item) => item.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除评论失败')
    } finally {
      setProcessingId(null)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 text-gray-300">登录状态检查中...</div>
      </main>
    )
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">需要登录</h1>
          <p className="text-gray-400 mb-6">评论管理仅对登录用户开放。</p>
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: '/comments/manage' })} className="cyber-button px-5 py-2 rounded-lg">前往登录</button>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">仅管理员可访问</h1>
          <p className="text-gray-400 mb-6">评论管理仅对系统管理员开放。</p>
          <button type="button" onClick={() => signIn(undefined, { callbackUrl: '/comments/manage' })} className="cyber-button px-5 py-2 rounded-lg">切换账号</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">评论管理</h1>
          <Link href="/coding" className="text-cyan-400 hover:text-cyan-300">前往 AI Coding</Link>
        </div>

        <div className="cyber-card rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-300">状态筛选</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'hidden')}
            className="bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
          >
            <option value="all">全部</option>
            <option value="active">有效</option>
            <option value="hidden">已隐藏</option>
          </select>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white min-w-[220px]"
            placeholder="搜索评论内容 / 作者 / 目标"
          />
          <button
            type="button"
            onClick={() => loadComments()}
            className="rounded-lg border border-cyan-500/30 px-3 py-2 text-sm text-cyan-300 hover:text-cyan-200"
          >
            刷新
          </button>
        </div>

        {loading ? (
          <div className="cyber-card rounded-2xl p-6 text-gray-400">评论加载中...</div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const targetHref = `/${comment.review.target.type}/${comment.review.target.slug}`
              return (
                <div key={comment.id} className="cyber-card rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-white text-sm">{comment.authorName}</p>
                      <p className="text-xs text-gray-500">
                        状态: {comment.status === 'hidden' ? '隐藏' : '有效'} · 赞: {comment.likesCount} · {new Date(comment.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {comment.status !== 'hidden' ? (
                        <button
                          type="button"
                          disabled={processingId === comment.id}
                          onClick={() => updateStatus(comment.id, 'hide')}
                          className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-300 hover:text-yellow-200 disabled:opacity-60"
                        >
                          隐藏评论
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={processingId === comment.id}
                          onClick={() => updateStatus(comment.id, 'publish')}
                          className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-60"
                        >
                          恢复显示
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={processingId === comment.id}
                        onClick={() => removeComment(comment.id)}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:text-red-200 disabled:opacity-60"
                      >
                        删除评论
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 whitespace-pre-wrap break-all mb-3">{comment.content}</p>

                  <div className="text-xs text-gray-400">
                    目标：
                    <Link href={targetHref} className="text-cyan-400 hover:text-cyan-300">
                      {comment.review.target.name}
                    </Link>
                  </div>
                </div>
              )
            })}

            {!loading && comments.length === 0 && (
              <div className="cyber-card rounded-2xl p-6 text-gray-500">当前筛选下暂无评论</div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
      <SiteFooter />
    </main>
  )
}
