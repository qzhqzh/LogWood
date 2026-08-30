import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  PromptGlitchTitle,
  promptGlitchDelay,
  promptGlitchProfile,
} from './prompt-glitch-title'

describe('PromptGlitchTitle', () => {
  it('renders readable title text before any client animation runs', () => {
    const html = renderToStaticMarkup(createElement(PromptGlitchTitle))

    expect(html).toContain('PROMPT')
    expect(html).toContain('is-glitching')
    expect(html).toContain('data-text="PROMPT"')
    expect(html).toContain('data-glitch-profile="burst"')
    expect(html).toContain('prompt-glitch-title__fault')
  })

  it('maps entropy to a bounded non-fixed delay window', () => {
    expect(promptGlitchDelay(0)).toBe(2_600)
    expect(promptGlitchDelay(0.5)).toBe(5_600)
    expect(promptGlitchDelay(1)).toBe(8_600)
  })

  it('varies the visual fault profile independently from its timing', () => {
    expect(promptGlitchProfile(0)).toBe('split')
    expect(promptGlitchProfile(0.5)).toBe('burst')
    expect(promptGlitchProfile(1)).toBe('drop')
  })
})
