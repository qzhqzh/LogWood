'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

type DraftKind = 'article' | 'skill'
type DraftMode = 'ai' | 'local'

const SKILL_CATEGORIES = [
  { value: 'workflow', label: '工作流' },
  { value: 'frontend', label: '前端组件' },
  { value: 'style', label: '视觉风格' },
  { value: 'image', label: '图像生成' },
  { value: 'copy', label: '文案提示' },
  { value: 'other', label: '其他' },
] as const

interface CandidateOption { id: string; title: string; status: string }

const ERROR_MESSAGES: Record<string, string> = {
  ERR_FORGE_AI_NOT_CONFIGURED: 'AI Provider 尚未配置；可以切换到本地模板继续。',
  ERR_FORGE_AI_AUTH: 'AI Provider 凭据被拒绝；请检查服务端密钥后重试。',
  ERR_FORGE_AI_UNAVAILABLE: 'AI Provider 暂时不可用；输入已保留，可用同一请求安全重试。',
  ERR_FORGE_AI_INVALID_RESPONSE: '模型返回无法验证的结构；输入已保留，可重试或改用本地模板。',
  ERR_FORGE_IN_PROGRESS: '同一请求仍在处理中；请稍后重试，不会重复创建草稿。',
  ERR_FORGE_RETRY_EXHAUSTED: '同一请求已达到重试上限；修改输入后可发起新请求。',
  ERR_FORGE_IDEMPOTENCY_CONFLICT: '请求标识与输入不一致；请修改输入后重新提交。',
}

export function ForgeDraftForm() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [kind, setKind] = useState<DraftKind>('skill')
  const [mode, setMode] = useState<DraftMode>('ai')
  const [category, setCategory] = useState('workflow')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [sourceCandidateId, setSourceCandidateId] = useState('')
  const [candidates, setCandidates] = useState<CandidateOption[]>([])
  const [requestKey, setRequestKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(false)
  const [resultHref, setResultHref] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      fetch('/api/ai/status', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
      fetch('/api/candidates?admin=1', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
    ]).then(([runtime, candidatePayload]) => {
      const forge = runtime?.capabilities?.find((item: { id: string }) => item.id === 'forge-draft')
      if (forge && !forge.configured) setMode('local')
      const options = (candidatePayload?.candidates || [])
        .filter((candidate: CandidateOption) => candidate.status === 'watching' || candidate.status === 'evaluating')
      setCandidates(options)
    }).catch(() => {
      // The explicit runtime panel reports connection errors; the form stays usable.
    })
  }, [isAdmin])

  function resetRequestIdentity() {
    setRequestKey(null)
    setError(null)
    setRetryable(false)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!isAdmin) {
      setError('AI 造物台的草稿写入仅管理员可用')
      return
    }
    const key = requestKey || crypto.randomUUID()
    setRequestKey(key)
    try {
      setLoading(true)
      setError(null)
      setRetryable(false)
      setResultHref(null)
      setNote(null)
      const response = await fetch('/api/forge/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          kind,
          mode,
          prompt,
          title: title.trim() || undefined,
          category: kind === 'skill' ? category : undefined,
          sourceCandidateId: sourceCandidateId || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRetryable(Boolean(data.retryable))
        throw new Error(data.error || 'ERR_FORGE_FAILED')
      }
      setResultHref(data.saved?.href || null)
      setNote(data.note || '草稿已保存')
      setPrompt('')
      setTitle('')
      setSourceCandidateId('')
      setRequestKey(null)
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : 'ERR_FORGE_FAILED'
      setError(ERROR_MESSAGES[code] || '草稿整理失败；输入已保留，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-divider p-6 text-left text-sm leading-6 text-muted">
        登录管理员账号后，可把灵感整理成带来源和版本记录的洞笔记或 Skill 草稿。AI 只写草稿，公开发布仍需人工门禁。
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-divider bg-[var(--color-surface-1)] p-5 text-left sm:p-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold text-[var(--color-text-strong)]">草稿去向</legend>
          <div className="mt-3 flex gap-2">
            {(['article', 'skill'] as DraftKind[]).map((value) => (
              <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); resetRequestIdentity() }} className={`min-h-10 rounded-lg border px-4 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${kind === value ? 'border-cyan-400 text-cyan-200' : 'border-divider text-muted'}`}>
                {value === 'article' ? '笔记草稿' : '提示词草稿'}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-[var(--color-text-strong)]">整理方式</legend>
          <div className="mt-3 flex gap-2">
            {(['ai', 'local'] as DraftMode[]).map((value) => (
              <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); resetRequestIdentity() }} className={`min-h-10 rounded-lg border px-4 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${mode === value ? 'border-pink-400 text-pink-200' : 'border-divider text-muted'}`}>
                {value === 'ai' ? 'AI 协作' : '本地模板'}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {kind === 'skill' ? (
          <label className="block text-sm text-soft">
            提示词分类
            <select value={category} onChange={(event) => { setCategory(event.target.value); resetRequestIdentity() }} className="mt-2 min-h-11 w-full rounded-lg border border-divider bg-[var(--color-surface-2)] px-3 text-[var(--color-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
              {SKILL_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        ) : <div />}
        <label className="block text-sm text-soft">
          来源灵感（可选）
          <select value={sourceCandidateId} onChange={(event) => { setSourceCandidateId(event.target.value); resetRequestIdentity() }} className="mt-2 min-h-11 w-full rounded-lg border border-divider bg-[var(--color-surface-2)] px-3 text-[var(--color-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
            <option value="">不关联灵感</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm text-soft">
        标题提示（可选）
        <input value={title} onChange={(event) => { setTitle(event.target.value); resetRequestIdentity() }} className="mt-2 min-h-11 w-full rounded-lg border border-divider bg-[var(--color-surface-2)] px-3 text-[var(--color-text-strong)] placeholder:text-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" placeholder="让模型或模板知道这份草稿的重点" />
      </label>
      <label className="mt-4 block text-sm text-soft">
        原始材料
        <textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); resetRequestIdentity() }} rows={7} required minLength={8} className="mt-2 w-full rounded-lg border border-divider bg-[var(--color-surface-2)] px-3 py-3 text-[var(--color-text-strong)] placeholder:text-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" placeholder={kind === 'skill' ? '写下目标、输入输出、可复用步骤和已知边界…' : '写下灵感、实验记录、踩坑、来源和仍待验证的问题…'} />
      </label>
      <p className="mt-3 text-xs leading-5 text-soft">
        {mode === 'ai' ? '模型调用带幂等键与恢复性错误；成功结果保存完整归属。' : '本地模板不调用模型，也不会标记为 AI 生成。'} 两种方式都只生成草稿。
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={loading || prompt.trim().length < 8} className="cyber-button min-h-11 rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? '正在整理且防止重复写入…' : '整理并写入草稿'}
        </button>
        {retryable && error ? (
          <button type="submit" disabled={loading} className="min-h-11 rounded-lg border border-amber-400/50 px-4 text-sm text-amber-200 hover:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">使用同一请求安全重试</button>
        ) : null}
      </div>
      {error ? <p className="mt-4 text-sm leading-6 text-red-300" role="alert">{error}</p> : null}
      {note ? (
        <p className="mt-4 text-sm leading-6 text-soft" role="status">
          {note}{resultHref ? <> <Link href={resultHref} className="text-cyan-300 hover:text-cyan-200">打开管理页</Link></> : null}
        </p>
      ) : null}
    </form>
  )
}
