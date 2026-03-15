'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { SiteFooter } from '@/components/site-footer'

type TagSentiment = 'good' | 'bad' | 'neutral'

interface TagItem {
  id: string
  name: string
  slug: string
  sentiment: TagSentiment
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

function sentimentClass(sentiment: TagSentiment): string {
  if (sentiment === 'good') {
    return 'bg-emerald-500/12 border-emerald-400/35 text-emerald-200'
  }

  if (sentiment === 'bad') {
    return 'bg-rose-500/12 border-rose-400/35 text-rose-200'
  }

  return 'bg-violet-500/12 border-violet-400/35 text-violet-200'
}

export default function TagsPage() {
  const { status } = useSession()
  const [tags, setTags] = useState<TagItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [draftGoodVisible, setDraftGoodVisible] = useState(false)
  const [draftBadVisible, setDraftBadVisible] = useState(false)
  const [draftNeutralVisible, setDraftNeutralVisible] = useState(false)
  const [draftGoodName, setDraftGoodName] = useState('')
  const [draftBadName, setDraftBadName] = useState('')
  const [draftNeutralName, setDraftNeutralName] = useState('')
  const [submittingSentiment, setSubmittingSentiment] = useState<TagSentiment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAuthed = status === 'authenticated'

  const loadTags = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/tags', { cache: 'no-store' })
      const data = await safeReadJson<{ tags?: TagItem[]; error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || `加载标签失败（${res.status}）`)
      }
      setTags(data?.tags || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载标签失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTags().catch(() => undefined)
  }, [loadTags])

  const filteredTags = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return tags
    return tags.filter((tag) => tag.name.toLowerCase().includes(normalized))
  }, [tags, keyword])

  const goodTags = useMemo(
    () => filteredTags.filter((tag) => tag.sentiment === 'good'),
    [filteredTags]
  )

  const badTags = useMemo(
    () => filteredTags.filter((tag) => tag.sentiment === 'bad'),
    [filteredTags]
  )

  const neutralTags = useMemo(
    () => filteredTags.filter((tag) => tag.sentiment === 'neutral'),
    [filteredTags]
  )

  async function createTag(sentiment: TagSentiment) {
    const draftName =
      sentiment === 'good'
        ? draftGoodName
        : sentiment === 'bad'
          ? draftBadName
          : draftNeutralName
    if (!isAuthed || !draftName.trim()) return

    try {
      setSubmittingSentiment(sentiment)
      setError(null)
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftName.trim(),
          sentiment,
        }),
      })
      const data = await safeReadJson<{ error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || `新增标签失败（${res.status}）`)
      }

      if (sentiment === 'good') {
        setDraftGoodName('')
        setDraftGoodVisible(false)
      } else if (sentiment === 'bad') {
        setDraftBadName('')
        setDraftBadVisible(false)
      } else {
        setDraftNeutralName('')
        setDraftNeutralVisible(false)
      }
      await loadTags()
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增标签失败')
    } finally {
      setSubmittingSentiment(null)
    }
  }

  async function removeTag(id: string) {
    if (!isAuthed) return

    try {
      setDeletingId(id)
      setError(null)
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
      const data = await safeReadJson<{ error?: string }>(res)
      if (!res.ok) {
        throw new Error(data?.error || `删除标签失败（${res.status}）`)
      }

      setTags((prev) => prev.filter((tag) => tag.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除标签失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-block mb-4 px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-500/5">
              <span className="text-cyan-400 text-sm tracking-widest uppercase">GLOBAL TAG POOL</span>
            </div>
            <h1 className="text-4xl font-bold font-['Orbitron'] gradient-text mb-4">标签池</h1>
            <p className="text-gray-400 max-w-3xl">标签是全站通用的，不再区分板块。通过颜色区分标签属性，支持直接新增和删除。</p>
          </div>
        </div>

        <div className="mb-6">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full md:w-[420px] bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white"
            placeholder="搜索标签"
          />
        </div>

        {loading ? (
          <div className="cyber-card rounded-2xl p-6 text-gray-400">标签加载中...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <section className="cyber-card rounded-2xl p-5">
              <h2 className="text-sm tracking-[0.24em] uppercase text-emerald-300 mb-4">正向词条</h2>
              <div className="flex flex-wrap gap-2.5 items-start">
                {goodTags.map((tag) => (
                  <div key={tag.id} className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs leading-none ${sentimentClass(tag.sentiment)}`}>
                    <span className="font-medium">{tag.name}</span>
                    {isAuthed && (
                      <button
                        type="button"
                        onClick={() => removeTag(tag.id)}
                        disabled={deletingId === tag.id}
                        className="ml-0.5 text-current/70 hover:text-current disabled:opacity-60 transition-colors"
                        aria-label={`删除标签 ${tag.name}`}
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}

                {draftGoodVisible && isAuthed && (
                  <input
                    value={draftGoodName}
                    onChange={(e) => setDraftGoodName(e.target.value)}
                    onBlur={() => {
                      if (!draftGoodName.trim()) setDraftGoodVisible(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createTag('good')
                      }
                      if (e.key === 'Escape') {
                        setDraftGoodName('')
                        setDraftGoodVisible(false)
                      }
                    }}
                    autoFocus
                    className="w-[120px] rounded-full border border-emerald-400/35 bg-[#111a14] px-3 py-1.5 text-xs text-emerald-100 outline-none focus:border-emerald-300"
                    placeholder="输入标签"
                  />
                )}

                {isAuthed ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftGoodVisible(true)
                      setDraftBadVisible(false)
                      setDraftNeutralVisible(false)
                    }}
                    disabled={submittingSentiment === 'good'}
                    className="inline-flex items-center rounded-full border border-emerald-400/45 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-300 hover:text-emerald-200 transition-colors disabled:opacity-60"
                  >
                    {submittingSentiment === 'good' ? '新增中...' : '新增'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => signIn(undefined, { callbackUrl: '/tags' })}
                    className="inline-flex items-center rounded-full border border-emerald-400/45 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-300 hover:text-emerald-200 transition-colors"
                  >
                    登录后新增
                  </button>
                )}
              </div>
              {goodTags.length === 0 && !draftGoodVisible && (
                <p className="text-xs text-gray-500 mt-3">当前没有匹配的好标签</p>
              )}
            </section>

            <section className="cyber-card rounded-2xl p-5">
              <h2 className="text-sm tracking-[0.24em] uppercase text-rose-300 mb-4">负向词条</h2>
              <div className="flex flex-wrap gap-2.5 items-start">
                {badTags.map((tag) => (
                  <div key={tag.id} className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs leading-none ${sentimentClass(tag.sentiment)}`}>
                    <span className="font-medium">{tag.name}</span>
                    {isAuthed && (
                      <button
                        type="button"
                        onClick={() => removeTag(tag.id)}
                        disabled={deletingId === tag.id}
                        className="ml-0.5 text-current/70 hover:text-current disabled:opacity-60 transition-colors"
                        aria-label={`删除标签 ${tag.name}`}
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}

                {draftBadVisible && isAuthed && (
                  <input
                    value={draftBadName}
                    onChange={(e) => setDraftBadName(e.target.value)}
                    onBlur={() => {
                      if (!draftBadName.trim()) setDraftBadVisible(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createTag('bad')
                      }
                      if (e.key === 'Escape') {
                        setDraftBadName('')
                        setDraftBadVisible(false)
                      }
                    }}
                    autoFocus
                    className="w-[120px] rounded-full border border-rose-400/35 bg-[#1a1114] px-3 py-1.5 text-xs text-rose-100 outline-none focus:border-rose-300"
                    placeholder="输入标签"
                  />
                )}

                {isAuthed ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftBadVisible(true)
                      setDraftGoodVisible(false)
                      setDraftNeutralVisible(false)
                    }}
                    disabled={submittingSentiment === 'bad'}
                    className="inline-flex items-center rounded-full border border-rose-400/45 px-3 py-1.5 text-xs font-medium text-rose-300 hover:border-rose-300 hover:text-rose-200 transition-colors disabled:opacity-60"
                  >
                    {submittingSentiment === 'bad' ? '新增中...' : '新增'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => signIn(undefined, { callbackUrl: '/tags' })}
                    className="inline-flex items-center rounded-full border border-rose-400/45 px-3 py-1.5 text-xs font-medium text-rose-300 hover:border-rose-300 hover:text-rose-200 transition-colors"
                  >
                    登录后新增
                  </button>
                )}
              </div>
              {badTags.length === 0 && !draftBadVisible && (
                <p className="text-xs text-gray-500 mt-3">当前没有匹配的不好标签</p>
              )}
            </section>

            <section className="cyber-card rounded-2xl p-5">
              <h2 className="text-sm tracking-[0.24em] uppercase text-violet-300 mb-4">中性词条</h2>
              <div className="flex flex-wrap gap-2.5 items-start">
                {neutralTags.map((tag) => (
                  <div key={tag.id} className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs leading-none ${sentimentClass(tag.sentiment)}`}>
                    <span className="font-medium">{tag.name}</span>
                    {isAuthed && (
                      <button
                        type="button"
                        onClick={() => removeTag(tag.id)}
                        disabled={deletingId === tag.id}
                        className="ml-0.5 text-current/70 hover:text-current disabled:opacity-60 transition-colors"
                        aria-label={`删除标签 ${tag.name}`}
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}

                {draftNeutralVisible && isAuthed && (
                  <input
                    value={draftNeutralName}
                    onChange={(e) => setDraftNeutralName(e.target.value)}
                    onBlur={() => {
                      if (!draftNeutralName.trim()) setDraftNeutralVisible(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createTag('neutral')
                      }
                      if (e.key === 'Escape') {
                        setDraftNeutralName('')
                        setDraftNeutralVisible(false)
                      }
                    }}
                    autoFocus
                    className="w-[120px] rounded-full border border-violet-400/35 bg-[#170f22] px-3 py-1.5 text-xs text-violet-100 outline-none focus:border-violet-300"
                    placeholder="输入标签"
                  />
                )}

                {isAuthed ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftNeutralVisible(true)
                      setDraftGoodVisible(false)
                      setDraftBadVisible(false)
                    }}
                    disabled={submittingSentiment === 'neutral'}
                    className="inline-flex items-center rounded-full border border-violet-400/45 px-3 py-1.5 text-xs font-medium text-violet-300 hover:border-violet-300 hover:text-violet-200 transition-colors disabled:opacity-60"
                  >
                    {submittingSentiment === 'neutral' ? '新增中...' : '新增'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => signIn(undefined, { callbackUrl: '/tags' })}
                    className="inline-flex items-center rounded-full border border-violet-400/45 px-3 py-1.5 text-xs font-medium text-violet-300 hover:border-violet-300 hover:text-violet-200 transition-colors"
                  >
                    登录后新增
                  </button>
                )}
              </div>
              {neutralTags.length === 0 && !draftNeutralVisible && (
                <p className="text-xs text-gray-500 mt-3">当前没有匹配的中性标签</p>
              )}
            </section>
          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
      <SiteFooter />
    </main>
  )
}
