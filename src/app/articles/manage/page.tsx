'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { signIn, useSession } from 'next-auth/react'
import type { ArticleStatus as PrismaArticleStatus } from '@prisma/client'
import { encodeArticleSlug } from '@/modules/article'

const RichTextEditor = dynamic(() => import('@/components/rich-text-editor'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[280px] rounded-lg border border-cyan-500/30 bg-[#12121a]" />
  ),
})

type ArticleStatus = 'draft' | 'published' | 'archived'

interface ArticleItem {
  id: string
  title: string
  slug: string
  status: ArticleStatus
  updatedAt: string
  publishedAt: string | null
  viewCount: number
}

export default function ManageArticlesPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('<p></p>')
  const [contentTextLength, setContentTextLength] = useState(0)
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [status, setStatus] = useState<ArticleStatus>('draft')
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return title.trim().length >= 3 && contentTextLength >= 20
  }, [title, contentTextLength])

  const currentUserLabel = useMemo(() => {
    const name = session?.user?.name?.trim()
    const email = session?.user?.email?.trim()
    if (name) return name
    if (email) return email
    if (session?.user?.id) return `ID: ${session.user.id}`
    return '未知用户'
  }, [session])

  async function loadArticles() {
    const res = await fetch('/api/articles?manage=true', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '加载失败')
    }
    setArticles(data.articles)
  }

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    loadArticles().catch((e) => setError(e.message))
  }, [sessionStatus])

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
          <p className="text-gray-400 mb-6">文章管理仅对登录用户开放。</p>
          <button
            type="button"
            onClick={() => signIn(undefined, { callbackUrl: '/articles/manage' })}
            className="cyber-button px-5 py-2 rounded-lg"
          >
            前往登录
          </button>
        </div>
      </main>
    )
  }

  async function submitArticle(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('提交失败：标题至少 3 个字，正文至少 20 个字')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          excerpt: excerpt || undefined,
          content,
          coverImageUrl: coverImageUrl.trim() || undefined,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '创建失败（请先登录）')
      }

      setTitle('')
      setExcerpt('')
      setContent('<p></p>')
      setContentTextLength(0)
      setCoverImageUrl('')
      setStatus('draft')
      await loadArticles()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  async function archive(id: string) {
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '归档失败')
      await loadArticles()
    } catch (e) {
      setError(e instanceof Error ? e.message : '归档失败')
    }
  }

  async function changeStatus(id: string, nextStatus: PrismaArticleStatus) {
    try {
      setUpdatingId(id)
      setError(null)
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '更新状态失败')
      await loadArticles()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新状态失败')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">文章管理</h1>
          <Link href="/articles" className="text-cyan-400 hover:text-cyan-300">前往文章列表</Link>
        </div>

        <form onSubmit={submitArticle} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div>
            <label className="block text-sm mb-2 text-gray-300">标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
              placeholder="输入文章标题"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-300">摘要</label>
            <input
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
              placeholder="用于列表展示的简要摘要"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-300">封面图 URL（可选）</label>
            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-300">内容</label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              onTextLengthChange={setContentTextLength}
            />
            <p className="text-xs text-gray-500 mt-2">正文最少 20 个字，当前 {contentTextLength} 字</p>
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-300">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ArticleStatus)}
              className="bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
            >
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? '提交中...' : '创建文章'}
          </button>

          {!canSubmit && (
            <p className="text-xs text-yellow-300">当前还不能提交：标题至少 3 字，正文至少 20 字。</p>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <p className="text-xs text-gray-500">当前登录用户：{currentUserLabel}</p>
        </form>

        <div className="cyber-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">文章列表</h2>
          <div className="space-y-3">
            {articles.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-cyan-500/15 rounded-lg p-3">
                <div>
                  <p className="text-white">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    /articles/{item.slug} · {item.status} · {item.viewCount} 阅读
                  </p>
                </div>
                <div className="flex gap-3 items-center">
                  <Link className="text-cyan-400 hover:text-cyan-300" href={`/articles/${encodeArticleSlug(item.slug)}`}>查看</Link>
                  {item.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(item.id, 'published')}
                      disabled={updatingId === item.id}
                      className="text-emerald-300 hover:text-emerald-200 disabled:opacity-60"
                    >
                      {updatingId === item.id ? '发布中...' : '发布'}
                    </button>
                  )}
                  {item.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(item.id, 'draft')}
                      disabled={updatingId === item.id}
                      className="text-yellow-300 hover:text-yellow-200 disabled:opacity-60"
                    >
                      {updatingId === item.id ? '处理中...' : '转为草稿'}
                    </button>
                  )}
                  {item.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => archive(item.id)}
                      className="text-orange-300 hover:text-orange-200"
                    >
                      归档
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
