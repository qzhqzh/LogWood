import React from 'react'
import Image from 'next/image'

interface PromptEffectStageProps {
  title: string
  prompt: string
  effectImageUrl?: string | null
  effectNote?: string | null
  priority?: boolean
  compact?: boolean
}

export function PromptEffectStage({
  title,
  prompt,
  effectImageUrl,
  effectNote,
  priority = false,
  compact = false,
}: PromptEffectStageProps) {
  return (
    <figure className={`prompt-effect-stage ${compact ? 'prompt-effect-stage--compact' : ''}`}>
      <div className="prompt-effect-stage__viewport">
        {effectImageUrl ? (
          <Image
            src={effectImageUrl}
            alt={effectNote || `${title} 的实际效果预览`}
            width={880}
            height={520}
            priority={priority}
            unoptimized
            sizes={compact ? '(max-width: 768px) 92vw, 30vw' : '(max-width: 1024px) 92vw, 55vw'}
            className="prompt-effect-stage__image"
          />
        ) : (
          <div className="prompt-effect-stage__fallback">
            <span aria-hidden="true" className="prompt-effect-stage__glyphs">
              :: ·· :: ···· :: ·· ::
            </span>
            <p>尚未记录效果图，先展示可执行提示词。</p>
            <pre>{prompt}</pre>
          </div>
        )}
      </div>
      <figcaption>
        {effectImageUrl
          ? effectNote || '由这条提示词保存的真实效果记录。'
          : '没有用生成占位图冒充效果；补充真实结果后会在这里居中展示。'}
      </figcaption>
    </figure>
  )
}
