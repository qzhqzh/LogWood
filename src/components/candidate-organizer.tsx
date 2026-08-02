'use client'

import { FormEvent, useState } from 'react'
import { Check, LoaderCircle, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type OrganizableStatus = 'watching' | 'evaluating' | 'dropped'

interface CandidateOrganizerProps {
  candidateId: string
  initialStatus: string
  initialTags: string[]
  canEdit: boolean
}

const STATUS_OPTIONS: Array<{
  value: OrganizableStatus
  label: string
  activeClass: string
}> = [
  {
    value: 'watching',
    label: '未处理',
    activeClass: 'border-amber-400/50 bg-amber-400/10 text-amber-200',
  },
  {
    value: 'evaluating',
    label: '观察中',
    activeClass: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
  },
  {
    value: 'dropped',
    label: '送入废品站',
    activeClass: 'border-rose-400/50 bg-rose-400/10 text-rose-200',
  },
]

export function CandidateOrganizer({
  candidateId,
  initialStatus,
  initialTags,
  canEdit,
}: CandidateOrganizerProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [tags, setTags] = useState(initialTags)
  const [draftTag, setDraftTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = async (body: {
    status?: OrganizableStatus
    tags?: string[]
  }) => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/candidates/${candidateId}/organize`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || '保存失败')
      }
      router.refresh()
      return true
    } catch {
      setError('保存失败，请稍后重试。')
      return false
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (nextStatus: OrganizableStatus) => {
    if (!canEdit || saving || status === nextStatus) return
    const previousStatus = status
    setStatus(nextStatus)
    if (!await update({ status: nextStatus })) {
      setStatus(previousStatus)
    }
  }

  const addTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextTag = draftTag.trim().replace(/^#+/, '')
    if (!nextTag || saving || tags.includes(nextTag) || tags.length >= 12) return
    const nextTags = [...tags, nextTag]
    setTags(nextTags)
    setDraftTag('')
    if (!await update({ tags: nextTags })) {
      setTags(tags)
    }
  }

  const removeTag = async (tag: string) => {
    if (!canEdit || saving) return
    const nextTags = tags.filter((item) => item !== tag)
    setTags(nextTags)
    if (!await update({ tags: nextTags })) {
      setTags(tags)
    }
  }

  return (
    <section className="mb-8 border-y border-divider py-5" aria-labelledby="organize-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="organize-title" className="text-base font-semibold text-[var(--color-text-strong)]">
            整理灵感
          </h2>
          <p className="mt-1 text-sm text-soft">状态决定下一步去向，Tags 用于快速搜索。</p>
        </div>
        {saving && (
          <span className="inline-flex items-center gap-2 text-xs text-soft" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            保存中
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="灵感归类">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => void changeStatus(option.value)}
            disabled={!canEdit || saving || initialStatus === 'promoted'}
            aria-pressed={status === option.value}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              status === option.value
                ? option.activeClass
                : 'border-divider text-muted hover:text-[var(--color-text-strong)]'
            }`}
          >
            {status === option.value && <Check className="h-4 w-4" aria-hidden="true" />}
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-divider px-2.5 text-sm text-muted"
          >
            {tag}
            {canEdit && (
              <button
                type="button"
                onClick={() => void removeTag(tag)}
                disabled={saving}
                aria-label={`移除 Tag ${tag}`}
                title="移除"
                className="flex h-7 w-7 items-center justify-center text-soft hover:text-rose-300"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {tags.length === 0 && <span className="py-2 text-sm text-soft">还没有 Tag</span>}
      </div>

      {canEdit && (
        <form className="mt-3 flex max-w-md gap-2" onSubmit={addTag}>
          <label htmlFor="candidate-tag" className="sr-only">新增 Tag</label>
          <input
            id="candidate-tag"
            value={draftTag}
            onChange={(event) => setDraftTag(event.target.value)}
            maxLength={30}
            disabled={saving || tags.length >= 12}
            placeholder={tags.length >= 12 ? '最多 12 个 Tags' : '输入一个 Tag'}
            className="h-11 min-w-0 flex-1 rounded-md border border-divider bg-black/20 px-3 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-soft focus:border-amber-400/60"
          />
          <button
            type="submit"
            disabled={!draftTag.trim() || saving || tags.length >= 12}
            aria-label="添加 Tag"
            title="添加 Tag"
            className="cyber-button flex h-11 w-11 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      )}

      {!canEdit && (
        <p className="mt-3 text-xs text-soft">只有灵感作者或管理员可以修改归类和 Tags。</p>
      )}
      {error && <p className="mt-3 text-sm text-rose-300" role="alert">{error}</p>}
    </section>
  )
}
