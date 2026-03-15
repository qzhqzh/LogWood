'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { signIn, useSession } from 'next-auth/react'
import type { ArticleStatus as PrismaArticleStatus } from '@prisma/client'
import { encodeArticleSlug } from '@/modules/article/slug'
import { TagPicker } from '@/components/tag-picker'
import { SiteFooter } from '@/components/site-footer'

const RichTextEditor = dynamic(() => import('@/components/rich-text-editor'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[280px] rounded-lg border border-cyan-500/30 bg-[#12121a]" />
  ),
})

type ArticleStatus = 'draft' | 'published' | 'archived'

interface ArticleColumnItem {
  id: string
  name: string
  slug: string
}

interface ArticleItem {
  id: string
  title: string
  slug: string
  columnId: string | null
  column: ArticleColumnItem | null
  excerpt: string | null
  content: string
  tags: string[]
  coverImageUrl: string | null
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
  const [columnId, setColumnId] = useState('')
  const [columns, setColumns] = useState<ArticleColumnItem[]>([])
  const [newColumnName, setNewColumnName] = useState('')
  const [creatingColumn, setCreatingColumn] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<ArticleStatus>('draft')
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return title.trim().length >= 3 && contentTextLength >= 20
  }, [title, contentTextLength])
  const isAdmin = session?.user?.role === 'admin'

  const currentUserLabel = useMemo(() => {
    const name = session?.user?.name?.trim()
    const email = session?.user?.email?.trim()
    if (name) return name
    if (email) return email
    if (session?.user?.id) return `ID: ${session.user.id}`
    return '未知用户'
  }, [session])

  function getTextLengthFromHtml(html: string) {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length
  }

  async function loadArticles() {
    const res = await fetch('/api/articles?manage=true', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '加载失败')
    }
    setArticles(data.articles)
  }

  async function loadColumns() {
    const res = await fetch('/api/article-columns', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '专栏加载失败')
    }
    setColumns(data.columns || [])
  }

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    Promise.all([loadArticles(), loadColumns()]).catch((e) => setError(e.message))
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

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">仅管理员可访问</h1>
          <p className="text-gray-400 mb-6">文章管理仅对系统管理员开放。GitHub 普通用户可在文章详情中参与评论。</p>
          <button
            type="button"
            onClick={() => signIn(undefined, { callbackUrl: '/articles/manage' })}
            className="cyber-button px-5 py-2 rounded-lg"
          >
            切换账号
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
      const url = editingArticleId ? `/api/articles/${editingArticleId}` : '/api/articles'
      const method = editingArticleId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          excerpt: excerpt || undefined,
          content,
          columnId: columnId || undefined,
          coverImageUrl: coverImageUrl.trim() || undefined,
          tags,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || (editingArticleId ? '编辑失败（请先登录）' : '创建失败（请先登录）'))
      }

      setTitle('')
      setExcerpt('')
      setContent('<p></p>')
      setContentTextLength(0)
      setCoverImageUrl('')
      setColumnId('')
      setTags([])
      setStatus('draft')
      setEditingArticleId(null)
      await loadArticles()
    } catch (e) {
      setError(e instanceof Error ? e.message : (editingArticleId ? '编辑失败' : '创建失败'))
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setTitle('')
    setExcerpt('')
    setContent('<p></p>')
    setContentTextLength(0)
    setCoverImageUrl('')
    setColumnId('')
    setTags([])
    setStatus('draft')
    setEditingArticleId(null)
    setError(null)
  }

  function editArticle(item: ArticleItem) {
    if (item.status === 'archived') return

    setTitle(item.title)
    setExcerpt(item.excerpt || '')
    const nextContent = item.content || '<p></p>'
    setContent(nextContent)
    setContentTextLength(getTextLengthFromHtml(nextContent))
    setCoverImageUrl(item.coverImageUrl || '')
    setColumnId(item.columnId || '')
    setTags(item.tags)
    setStatus(item.status)
    setEditingArticleId(item.id)
    setError(null)
  }

  async function createColumn() {
    const normalized = newColumnName.trim()
    if (!normalized) return

    try {
      setCreatingColumn(true)
      setError(null)
      const res = await fetch('/api/article-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalized }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '创建专栏失败')
      }

      const created = data as ArticleColumnItem
      setColumns((prev) => {
        if (prev.some((item) => item.id === created.id)) {
          return prev
        }
        return [...prev, created]
      })
      setColumnId(created.id)
      setNewColumnName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建专栏失败')
    } finally {
      setCreatingColumn(false)
    }
  }

  async function archive(id: string) {
    const confirmed = window.confirm('确认将该文章归档吗？归档后将从公开列表隐藏，但仍可保留历史记录。')
    if (!confirmed) return

    try {
      setUpdatingId(id)
      setError(null)
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '归档失败')
      await loadArticles()
    } catch (e) {
      setError(e instanceof Error ? e.message : '归档失败')
    } finally {
      setUpdatingId(null)
    }
  }

  async function removeArticle(id: string) {
    const confirmed = window.confirm('确认彻底删除该文章吗？此操作不可恢复。')
    if (!confirmed) return

    try {
      setDeletingId(id)
      setError(null)
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '删除失败')

      if (editingArticleId === id) {
        resetForm()
      }
      await loadArticles()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
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
              <Link href="/coding" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium tracking-wide">AI Coding</Link>
              <Link href="/app" className="text-purple-400 hover:text-purple-300 transition-colors font-medium tracking-wide">应用工坊</Link>
              <Link href="/articles" className="text-pink-400 font-medium tracking-wide">社区文章</Link>
              <Link href="/articles/manage" className="cyber-button px-5 py-2 rounded-lg font-semibold tracking-wide">文章管理</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">文章管理</h1>
          <Link href="/articles" className="text-cyan-400 hover:text-cyan-300">前往文章列表</Link>
        </div>

        <form onSubmit={submitArticle} className="cyber-card rounded-2xl p-6 mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{editingArticleId ? '编辑文章' : '新建文章'}</h2>
            {editingArticleId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-300 hover:text-white"
              >
                取消编辑
              </button>
            )}
          </div>
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
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={4}
              maxLength={200}
              className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white resize-y"
              placeholder="用于列表展示的简要摘要"
            />
            <p className="text-xs text-gray-500 mt-2">摘要最多 200 字，当前 {excerpt.length} 字</p>
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

          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-2 text-gray-300">专栏</label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
              >
                <option value="">未归入专栏</option>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>{column.name}</option>
                ))}
              </select>
            </div>
            <div className="grid md:grid-cols-[1fr_120px] gap-2">
              <input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
                placeholder="新建专栏（例如 vibe coding / Vision / Robot）"
              />
              <button
                type="button"
                onClick={createColumn}
                disabled={creatingColumn || newColumnName.trim().length === 0}
                className="cyber-button px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {creatingColumn ? '创建中...' : '新增专栏'}
              </button>
            </div>
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

          <div>
            <label className="block text-sm mb-2 text-gray-300">标签</label>
            <TagPicker value={tags} onChange={setTags} disabled={loading} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cyber-button px-5 py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? '提交中...' : (editingArticleId ? '保存修改' : '创建文章')}
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
                  {item.column && (
                    <p className="text-xs text-cyan-300 mt-1">专栏：{item.column.name}</p>
                  )}
                  {item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-xs">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                  <Link className="text-cyan-400 hover:text-cyan-300" href={`/articles/${encodeArticleSlug(item.slug)}`}>查看</Link>
                  {item.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => editArticle(item)}
                      className="text-indigo-300 hover:text-indigo-200"
                    >
                      编辑
                    </button>
                  )}
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
                      disabled={updatingId === item.id || deletingId === item.id}
                      className="text-orange-300 hover:text-orange-200 disabled:opacity-60"
                    >
                      {updatingId === item.id ? '归档中...' : '归档'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeArticle(item.id)}
                    disabled={deletingId === item.id || updatingId === item.id}
                    className="text-red-300 hover:text-red-200 disabled:opacity-60"
                  >
                    {deletingId === item.id ? '删除中...' : '删除'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
