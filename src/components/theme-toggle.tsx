'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

function getNextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme | undefined) || 'dark'
    setTheme(current)
  }, [])

  function handleToggle() {
    const nextTheme = getNextTheme(theme)
    setIsAnimating(true)
    document.documentElement.dataset.theme = nextTheme
    window.localStorage.setItem('logwood-theme', nextTheme)
    setTheme(nextTheme)
    window.setTimeout(() => setIsAnimating(false), 240)
  }

  const label = theme === 'dark' ? '当前：黑夜' : '当前：白天'

  return (
    <button
      type="button"
      className={`theme-toggle ${isAnimating ? 'theme-toggle-animating' : ''}`}
      onClick={handleToggle}
      aria-label="白天/黑夜 切换"
      title="白天/黑夜 切换"
    >
      <span className="theme-toggle-icon" aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
      <span className="theme-toggle-copy">
        <span>白天/黑夜</span>
        <span className="theme-toggle-state">{label}</span>
      </span>
    </button>
  )
}
