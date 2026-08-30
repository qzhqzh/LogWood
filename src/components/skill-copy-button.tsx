'use client'

import { useState } from 'react'
import { Copy } from 'lucide-react'

interface SkillCopyButtonProps {
  text: string
}

export function SkillCopyButton({ text }: SkillCopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      window.setTimeout(() => setState('idle'), 1600)
    } catch {
      setState('error')
      window.setTimeout(() => setState('idle'), 2400)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ascii-button"
      aria-live="polite"
    >
      <Copy className="h-4 w-4" aria-hidden />
      {state === 'copied' ? '已复制' : state === 'error' ? '复制失败' : '复制提示词'}
    </button>
  )
}
