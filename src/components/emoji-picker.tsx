'use client'

import { useEffect, useState } from 'react'

interface EmojiItem {
  id: string
  name: string
  symbol: string
}

interface EmojiPickerProps {
  onPick: (emoji: string) => void
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  const [emojis, setEmojis] = useState<EmojiItem[]>([])

  useEffect(() => {
    fetch('/api/emojis', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setEmojis(data.emojis || []))
      .catch(() => setEmojis([]))
  }, [])

  if (emojis.length === 0) {
    return null
  }

  return (
    <div className="mt-3">
      <div className="text-xs text-gray-500 mb-2">快捷表情</div>
      <div className="flex flex-wrap gap-2">
        {emojis.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.symbol)}
            className="px-2 py-1 rounded border border-cyan-500/30 text-sm text-gray-200 hover:bg-cyan-500/10 transition-colors"
            title={item.name}
          >
            {item.symbol}
          </button>
        ))}
      </div>
    </div>
  )
}
