'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { GitCompareArrows } from 'lucide-react'

export interface PromptCompareOption {
  slug: string
  title: string
  categoryLabel: string
  hasEffect: boolean
}

interface PromptComparePickerProps {
  prompts: PromptCompareOption[]
  initialSlugs?: string[]
}

const MAX_COMPARE = 3

export function PromptComparePicker({
  prompts,
  initialSlugs = [],
}: PromptComparePickerProps) {
  const allowedSlugs = useMemo(() => new Set(prompts.map((prompt) => prompt.slug)), [prompts])
  const [selected, setSelected] = useState(() => (
    initialSlugs.filter((slug) => allowedSlugs.has(slug)).slice(0, MAX_COMPARE)
  ))

  function toggle(slug: string) {
    setSelected((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug)
      if (current.length >= MAX_COMPARE) return current
      return [...current, slug]
    })
  }

  const compareHref = `/compare/prompts?ids=${selected.map(encodeURIComponent).join(',')}`

  return (
    <section className="ascii-picker" aria-labelledby="compare-picker-title">
      <div className="ascii-picker__heading">
        <div>
          <p className="ascii-kicker">[:: 同类对照 ::]</p>
          <h2 id="compare-picker-title">选择 2–3 条提示词并排查看</h2>
        </div>
        <p className="ascii-picker__count" aria-live="polite">已选 {selected.length}/{MAX_COMPARE}</p>
      </div>

      <fieldset className="ascii-picker__options">
        <legend className="sr-only">选择要对比的提示词</legend>
        {prompts.map((prompt, index) => {
          const checked = selected.includes(prompt.slug)
          const disabled = !checked && selected.length >= MAX_COMPARE
          return (
            <label key={prompt.slug} className={`ascii-picker__option ${checked ? 'is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(prompt.slug)}
              />
              <span className="ascii-picker__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="ascii-picker__name">{prompt.title}</span>
              <span className="ascii-picker__meta">
                {prompt.categoryLabel} · {prompt.hasEffect ? '有预览' : '文本结果'}
              </span>
            </label>
          )
        })}
      </fieldset>

      <div className="ascii-picker__actions">
        {selected.length >= 2 ? (
          <Link href={compareHref} className="ascii-button ascii-button--solid">
            <GitCompareArrows className="h-4 w-4" aria-hidden />
            打开对比页
          </Link>
        ) : (
          <span className="ascii-picker__hint">再选择 {2 - selected.length} 条即可开始对比</span>
        )}
        {selected.length > 0 ? (
          <button type="button" className="ascii-button" onClick={() => setSelected([])}>
            清空选择
          </button>
        ) : null}
      </div>
    </section>
  )
}
