'use client'

import React, { useEffect, useState } from 'react'

export const PROMPT_GLITCH_DURATION_MS = 960
const MIN_GLITCH_DELAY_MS = 2_600
const MAX_GLITCH_DELAY_MS = 8_600

export type PromptGlitchProfile = 'split' | 'burst' | 'drop'

function normalizedUnit(unit: number) {
  return Number.isFinite(unit) ? Math.min(1, Math.max(0, unit)) : 0.5
}

export function promptGlitchDelay(unit: number) {
  const normalized = normalizedUnit(unit)
  return Math.round(MIN_GLITCH_DELAY_MS + normalized * (MAX_GLITCH_DELAY_MS - MIN_GLITCH_DELAY_MS))
}

export function promptGlitchProfile(unit: number): PromptGlitchProfile {
  const normalized = normalizedUnit(unit)
  if (normalized < 1 / 3) return 'split'
  if (normalized < 2 / 3) return 'burst'
  return 'drop'
}

function randomUnit() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const value = new Uint32Array(1)
    globalThis.crypto.getRandomValues(value)
    return value[0] / 0xffffffff
  }
  return Math.random()
}

interface PromptGlitchTitleProps {
  className?: string
}

export function PromptGlitchTitle({ className = '' }: PromptGlitchTitleProps) {
  const [isGlitching, setIsGlitching] = useState(true)
  const [profile, setProfile] = useState<PromptGlitchProfile>('burst')

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let nextTimer: number | undefined
    let finishTimer: number | undefined

    function clearTimers() {
      if (nextTimer !== undefined) window.clearTimeout(nextTimer)
      if (finishTimer !== undefined) window.clearTimeout(finishTimer)
      nextTimer = undefined
      finishTimer = undefined
    }

    function scheduleNext() {
      clearTimers()
      if (reducedMotion.matches || document.hidden) return
      nextTimer = window.setTimeout(() => {
        setProfile(promptGlitchProfile(randomUnit()))
        setIsGlitching(true)
        finishTimer = window.setTimeout(() => {
          setIsGlitching(false)
          scheduleNext()
        }, PROMPT_GLITCH_DURATION_MS)
      }, promptGlitchDelay(randomUnit()))
    }

    function finishInitialGlitch() {
      setIsGlitching(false)
      scheduleNext()
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        clearTimers()
        setIsGlitching(false)
        return
      }
      scheduleNext()
    }

    function handleMotionPreference() {
      clearTimers()
      setIsGlitching(false)
      if (!reducedMotion.matches) scheduleNext()
    }

    if (reducedMotion.matches) {
      setIsGlitching(false)
    } else {
      finishTimer = window.setTimeout(finishInitialGlitch, PROMPT_GLITCH_DURATION_MS)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    reducedMotion.addEventListener('change', handleMotionPreference)

    return () => {
      clearTimers()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reducedMotion.removeEventListener('change', handleMotionPreference)
    }
  }, [])

  return (
    <h1
      className={`prompt-glitch-title ${isGlitching ? 'is-glitching' : ''} ${className}`.trim()}
      data-text="PROMPT"
      data-glitch-profile={profile}
    >
      <span>PROMPT</span>
      <i className="prompt-glitch-title__fault" aria-hidden="true" />
    </h1>
  )
}
