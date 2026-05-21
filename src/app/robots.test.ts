import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import robots from './robots'

const ORIGINAL_SITE_URL = process.env.SITE_URL

describe('app/robots', () => {
  beforeEach(() => {
    process.env.SITE_URL = 'https://logwood.test'
  })

  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = ORIGINAL_SITE_URL
  })

  it('disallows known low-value and management routes', () => {
    const result = robots()
    const rules = result.rules as { disallow: string[] }
    const disallow = rules.disallow

    for (const path of [
      '/api/',
      '/app/manage/',
      '/articles/manage/',
      '/comments/manage/',
      '/targets/manage/',
      '/auth/',
      '/submit',
      '/emojis',
      '/tags',
    ]) {
      expect(disallow).toContain(path)
    }
  })

  it('emits absolute sitemap URL', () => {
    const result = robots()
    expect(result.sitemap).toBe('https://logwood.test/sitemap.xml')
  })

  it('keeps allow=/ for public crawling', () => {
    const result = robots()
    const rules = result.rules as { allow: string }
    expect(rules.allow).toBe('/')
  })
})
