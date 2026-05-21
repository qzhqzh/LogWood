import { describe, expect, it } from 'vitest'
import { sanitizeArticleHtml } from './sanitize'

describe('article/sanitize', () => {
  it('downgrades <h1> to <h2> so the page-level title stays unique', () => {
    const out = sanitizeArticleHtml('<h1>Hello</h1>')
    expect(out).toContain('<h2>Hello</h2>')
    expect(out).not.toMatch(/<h1[\s>]/)
  })

  it('preserves <h2> and <h3> headings', () => {
    const out = sanitizeArticleHtml('<h2>two</h2><h3>three</h3>')
    expect(out).toContain('<h2>two</h2>')
    expect(out).toContain('<h3>three</h3>')
  })

  it('forces target=_blank and rel=noopener noreferrer nofollow on outbound links', () => {
    const out = sanitizeArticleHtml('<a href="https://example.com">click</a>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer nofollow"')
  })

  it('strips <script> tags entirely', () => {
    const out = sanitizeArticleHtml('<p>before</p><script>alert(1)</script><p>after</p>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('<p>before</p>')
    expect(out).toContain('<p>after</p>')
  })

  it('strips <iframe> and other disallowed tags', () => {
    const out = sanitizeArticleHtml('<iframe src="https://x"></iframe><object></object>')
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('<object')
  })

  it('keeps img/video with allowed attributes only', () => {
    const out = sanitizeArticleHtml(
      '<img src="https://x/a.png" alt="ok" onerror="boom"><video src="https://x/v.mp4" controls></video>',
    )
    expect(out).toContain('<img')
    expect(out).toContain('alt="ok"')
    expect(out).not.toContain('onerror')
    expect(out).toContain('<video')
    expect(out).toContain('controls')
  })

  it('blocks javascript: URLs in href', () => {
    const out = sanitizeArticleHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })
})
