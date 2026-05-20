import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canonicalFor, joinPath, toAbsoluteUrl } from './url'

const ORIGINAL_SITE_URL = process.env.SITE_URL
const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL

describe('shared/seo/url', () => {
  beforeEach(() => {
    process.env.SITE_URL = 'https://logwood.test'
    delete process.env.NEXTAUTH_URL
  })

  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = ORIGINAL_SITE_URL
    if (ORIGINAL_NEXTAUTH_URL === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL
  })

  describe('toAbsoluteUrl', () => {
    it('returns absolute URLs unchanged', () => {
      expect(toAbsoluteUrl('https://example.com/foo')).toBe('https://example.com/foo')
      expect(toAbsoluteUrl('http://example.com/foo')).toBe('http://example.com/foo')
    })

    it('prefixes site URL for relative paths', () => {
      expect(toAbsoluteUrl('/articles')).toBe('https://logwood.test/articles')
      expect(toAbsoluteUrl('articles')).toBe('https://logwood.test/articles')
    })

    it('handles empty path by returning site URL', () => {
      expect(toAbsoluteUrl('')).toBe('https://logwood.test')
    })

    it('preserves percent-encoded Chinese slugs', () => {
      const slug = encodeURIComponent('文章')
      expect(toAbsoluteUrl(`/articles/${slug}`)).toBe(`https://logwood.test/articles/${slug}`)
    })
  })

  describe('canonicalFor', () => {
    it('returns the bare site URL for / and empty', () => {
      expect(canonicalFor('/')).toBe('https://logwood.test')
      expect(canonicalFor('')).toBe('https://logwood.test')
    })

    it('strips trailing slashes for non-root paths', () => {
      expect(canonicalFor('/editor/')).toBe('https://logwood.test/editor')
      expect(canonicalFor('/articles///')).toBe('https://logwood.test/articles')
    })

    it('passes absolute URLs through (with trailing slash stripped)', () => {
      expect(canonicalFor('https://other.example/foo/')).toBe('https://other.example/foo')
    })

    it('canonicalizes nested paths', () => {
      expect(canonicalFor('/editor/cursor')).toBe('https://logwood.test/editor/cursor')
    })
  })

  describe('joinPath', () => {
    it('joins multiple segments with single slashes', () => {
      expect(joinPath('articles', 'columns', 'vibe-coding')).toBe('/articles/columns/vibe-coding')
    })

    it('strips redundant slashes', () => {
      expect(joinPath('/articles/', '/columns/', '/vibe-coding/')).toBe('/articles/columns/vibe-coding')
    })

    it('ignores nullish/empty segments', () => {
      expect(joinPath(null, 'app', undefined, '', 'cursor')).toBe('/app/cursor')
    })

    it('returns / when given nothing', () => {
      expect(joinPath()).toBe('/')
      expect(joinPath('', null, undefined)).toBe('/')
    })
  })

  describe('SITE_URL fallback', () => {
    it('falls back to NEXTAUTH_URL when SITE_URL is unset', () => {
      delete process.env.SITE_URL
      process.env.NEXTAUTH_URL = 'https://nextauth.test/'
      expect(toAbsoluteUrl('/')).toBe('https://nextauth.test/')
      expect(canonicalFor('/x')).toBe('https://nextauth.test/x')
    })
  })
})
