import { describe, expect, it } from 'vitest'
import { serializeJsonLd } from './json-ld'

describe('components/json-ld', () => {
  it('escapes characters that could terminate the script element', () => {
    const serialized = serializeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Thing',
      name: '</script><script>alert(1)</script>&',
    })

    expect(serialized).not.toContain('</script>')
    expect(serialized).not.toContain('<script>')
    expect(serialized).toContain('\\u003c/script\\u003e')
    expect(serialized).toContain('\\u0026')
  })
})
