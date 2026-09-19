import { describe, expect, it } from 'vitest'
import { sanitizeCallbackUrl } from './callback-url'

describe('identity/sanitizeCallbackUrl', () => {
  it('returns fallback when callback is empty', () => {
    expect(sanitizeCallbackUrl('', '/articles/manage')).toBe('/articles/manage')
  })

  it('keeps relative callback', () => {
    expect(sanitizeCallbackUrl('/articles/manage?tab=draft')).toBe('/articles/manage?tab=draft')
  })

  it('converts absolute external url to path', () => {
    expect(sanitizeCallbackUrl('https://logwood.example.com/articles/manage?tab=draft')).toBe('/articles/manage?tab=draft')
  })

  it('blocks localhost callback and falls back', () => {
    expect(sanitizeCallbackUrl('http://localhost:3000/articles/manage', '/articles/manage')).toBe('/articles/manage')
  })

  it('does not allow protocol-relative or non-HTTP login redirects', () => {
    expect(sanitizeCallbackUrl('//outside.example/steal', '/awesome/skills/hub')).toBe('/awesome/skills/hub')
    expect(sanitizeCallbackUrl('/\\outside.example/steal', '/awesome/skills/hub')).toBe('/awesome/skills/hub')
    expect(sanitizeCallbackUrl('https://outside.example//other.example', '/awesome/skills/hub')).toBe('/awesome/skills/hub')
    expect(sanitizeCallbackUrl('javascript:alert(1)', '/awesome/skills/hub')).toBe('/awesome/skills/hub')
  })
})
