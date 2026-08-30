'use client'

import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

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

  const nextThemeLabel = theme === 'dark' ? 'PAPER' : 'DARK'

  return (
    <button
      type="button"
      className={`theme-toggle ${isAnimating ? 'theme-toggle-animating' : ''}`}
      onClick={handleToggle}
      aria-label={`Switch to ${nextThemeLabel} theme`}
      aria-pressed={theme === 'light'}
      title={`Switch to ${nextThemeLabel} theme`}
    >
      {theme === 'dark'
        ? <Sun className="theme-toggle-icon" aria-hidden="true" />
        : <Moon className="theme-toggle-icon" aria-hidden="true" />}
      <span className="theme-toggle-copy">{nextThemeLabel}</span>
    </button>
  )
}
