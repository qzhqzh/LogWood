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
  if (!provider || !model || !modelVersion || !generatedAt) return null

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
