import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SiteNav } from './site-nav'

describe('SiteNav', () => {
  it('renders the KongXin brand and an English-only public navigation', () => {
    const html = renderToStaticMarkup(createElement(SiteNav, { active: 'evaluations' }))

    expect(html).toContain('KongXin')
    expect(html).toContain('PROMPT')
    expect(html).toContain('GALLERY')
    expect(html).toContain('AWESOME')
    expect(html).toContain('COMMUNITY')
    expect(html).toContain('ABOUT')
    expect(html).toContain('PAPER')
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toContain('EVIDENCE')
    expect(html).not.toContain('NOTES')
    expect(html).not.toContain('验证记录')
    expect(html).not.toContain('笔记')
    expect(html).not.toContain('关于')
  })
})
