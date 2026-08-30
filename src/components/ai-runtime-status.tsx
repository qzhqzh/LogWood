'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Bot, CheckCircle2 } from 'lucide-react'

interface RuntimeStatus {
  capabilities: Array<{
    id: string
    label: string
    configured: boolean
    provider: string
    model?: string
    humanGate: boolean
  }>
  replyQueue: { counts: Record<string, number>; latestFailures: unknown[] }
  forge: { counts: Record<string, number>; latestFailures: unknown[] }
  observedAt: string
}

export function AiRuntimeStatus() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/ai/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('status unavailable')
        return response.json() as Promise<RuntimeStatus>
      })
      .then((payload) => {
        if (active) setStatus(payload)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => { active = false }
  }, [])

  if (error) {
    return (
      <div className="mb-8 flex items-start gap-3 border-y border-[var(--color-warning-border)] py-4 text-sm text-[var(--color-warning-text)]" role="status">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        运行状态暂时不可读取。草稿输入不会丢失；稍后刷新状态或继续使用本地模板。
      </div>
    )
  }
  if (!status) {
    return (
      <div className="mb-8 flex min-h-16 items-center gap-3 border-y border-divider py-4 text-sm text-muted" role="status">
        <Activity className="h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden />
        正在读取能力与队列状态…
      </div>
    )
  }

  return (
    <section className="mb-8 border-y border-divider py-5 text-left" aria-labelledby="runtime-status-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="runtime-status-heading" className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-strong)]">
          <Activity className="h-4 w-4 text-cyan-300" aria-hidden />
          AI 连接与队列
        </h2>
        <time className="text-xs text-soft" dateTime={status.observedAt}>
          观测于 {new Date(status.observedAt).toLocaleString('zh-CN', { hour12: false })}
        </time>
      </div>
      <div className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {status.capabilities.map((capability) => (
          <div key={capability.id} className="flex items-start justify-between gap-4 border-b border-divider pb-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-strong)]">
                <Bot className="h-4 w-4" aria-hidden />
                {capability.label}
              </p>
              <p className="mt-1 text-xs text-soft">{capability.provider}{capability.model ? ` / ${capability.model}` : ''}{capability.humanGate ? ' · 人工门禁' : ''}</p>
            </div>
            <span className={`flex items-center gap-1 text-xs ${capability.configured ? 'text-emerald-300' : 'text-amber-300'}`}>
              {capability.configured ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
              {capability.configured ? '已配置' : '未配置'}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-soft">
        回复队列：待处理 {status.replyQueue.counts.pending || 0}，失败 {status.replyQueue.counts.failed || 0}；造物台：处理中 {status.forge.counts.processing || 0}，失败 {status.forge.counts.failed || 0}。
      </p>
    </section>
  )
}
