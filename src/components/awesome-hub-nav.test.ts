import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AwesomeHubNav } from './awesome-hub-nav'

describe('AwesomeHubNav', () => {
  it('keeps Projects, Skills and Feeds under one Awesome entry', () => {
    const html = renderToStaticMarkup(createElement(AwesomeHubNav, { active: 'skills' }))

    expect(html).toContain('href="/awesome"')
    expect(html).toContain('href="/awesome/skills"')
    expect(html).toContain('href="/awesome/feeds"')
    expect(html).toContain('aria-current="page"')
  })
})
