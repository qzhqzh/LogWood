import { Bot } from 'lucide-react'

interface AiAttributionProps {
  provider?: string | null
  model?: string | null
  modelVersion?: string | null
  generatedAt?: Date | string | null
  className?: string
}

export function AiAttribution({
  provider,
  model,
  modelVersion,
  generatedAt,
  className = '',
}: AiAttributionProps) {
  const hasAnyAttribution = Boolean(provider || model || modelVersion || generatedAt)
  if (!hasAnyAttribution) return null
  if (!provider || !model || !modelVersion || !generatedAt) {
    return (
      <span className={`inline-flex max-w-full items-center gap-1.5 text-xs text-amber-300 ${className}`}>
        <Bot aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        AI 归属记录不完整，发布前需补齐 Provider、Model、Version 与生成时间
      </span>
    )
  }

  const generatedAtIso = new Date(generatedAt).toISOString()
  const generatedAtLabel = generatedAtIso.replace('T', ' ').replace('.000Z', ' UTC')

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 text-xs text-soft ${className}`}
      title={`AI 生成于 ${generatedAtIso}`}
    >
      <Bot aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
      <span className="break-words">
        AI · {provider}/{model} · {modelVersion} · <time dateTime={generatedAtIso}>{generatedAtLabel}</time>
      </span>
    </span>
  )
}
