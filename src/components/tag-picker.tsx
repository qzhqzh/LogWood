'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type TagSentiment = 'good' | 'bad'

interface TagItem {
  id: string
  name: string
  sentiment: TagSentiment
}

interface TagPickerProps {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  allowCreate?: boolean
}

function sentimentClass(sentiment: TagSentiment): string {
  return sentiment === 'good'
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
}

export function TagPicker({ value, onChange, disabled = false, allowCreate = true }: TagPickerProps) {
  const [tags, setTags] = useState<TagItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [newName, setNewName] = useState('')
  const [newSentiment, setNewSentiment] = useState<TagSentiment>('good')
  const [creating, setCreating] = useState(false)

  const loadTags = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/tags', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '标签加载失败')
      }
      setTags(data.tags || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '标签加载失败')
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

  function toggleTag(tagName: string) {
    if (disabled) return

    if (value.includes(tagName)) {
      onChange(value.filter((item) => item !== tagName))
      return
    }

    onChange([...value, tagName])
  }

  async function quickCreate() {
    const normalizedName = newName.trim()
    if (!normalizedName || disabled) return

    try {
      setCreating(true)
      setError(null)
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          sentiment: newSentiment,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '标签创建失败')
      }

      const created = data as TagItem
      setTags((prev) => {
        if (prev.some((item) => item.id === created.id)) {
          return prev
        }
        return [...prev, created]
      })
      if (!value.includes(created.name)) {
        onChange([...value, created.name])
      }
      setNewName('')
      setNewSentiment('good')
    } catch (e) {
      setError(e instanceof Error ? e.message : '标签创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      {allowCreate && (
        <div className="grid md:grid-cols-[1fr_140px_120px] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={disabled || creating}
            className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white disabled:opacity-60"
            placeholder="快速新建标签"
          />
          <select
            value={newSentiment}
            onChange={(e) => setNewSentiment(e.target.value as TagSentiment)}
            disabled={disabled || creating}
            className="bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white disabled:opacity-60"
          >
            <option value="good">好</option>
            <option value="bad">不好</option>
          </select>
          <button
            type="button"
            onClick={quickCreate}
            disabled={disabled || creating || newName.trim().length === 0}
            className="cyber-button px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {creating ? '创建中...' : '创建并使用'}
          </button>
        </div>
      )}

      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        disabled={disabled}
        className="w-full bg-[#12121a] border border-cyan-500/30 rounded-lg px-3 py-2 text-white disabled:opacity-60"
        placeholder="搜索标签"
      />

      <div className="flex flex-wrap gap-2 min-h-8">
        {value.length === 0 ? (
          <span className="text-xs text-gray-500">尚未选择标签</span>
        ) : (
          value.map((tagName) => {
            const matched = tags.find((tag) => tag.name === tagName)
            return (
              <button
                key={tagName}
                type="button"
                onClick={() => toggleTag(tagName)}
                disabled={disabled}
                className={`px-3 py-1 rounded-full border text-xs ${matched ? sentimentClass(matched.sentiment) : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'} disabled:opacity-60`}
              >
                {tagName} ×
              </button>
            )
          })
        )}
      </div>

      <div className="relative py-2">
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
          <span className="px-3 text-[10px] tracking-[0.2em] uppercase text-cyan-300 bg-[#0a0a0f]">标签池</span>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">标签加载中...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag) => {
            const selected = value.includes(tag.name)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                disabled={disabled}
                className={`px-3 py-1 rounded-full border text-xs transition-colors disabled:opacity-60 ${selected ? sentimentClass(tag.sentiment) : 'border-white/15 text-gray-300 hover:border-cyan-400/40 hover:text-cyan-200'}`}
              >
                {tag.name}
              </button>
            )
          })}
          {filteredTags.length === 0 && <span className="text-xs text-gray-500">没有匹配标签</span>}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
