'use client'

import { useState } from 'react'

interface SkillCopyButtonProps {
  text: string
}

export function SkillCopyButton({ text }: SkillCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-[0.65rem] tracking-[0.12em] text-cyan-300/80 hover:text-cyan-200 transition-colors"
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  )
}
