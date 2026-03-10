import { describe, expect, it } from 'vitest'
import { decodeArticleSlug, encodeArticleSlug } from './slug'

describe('article/slug', () => {
  it('encodes and decodes slugs with emoji and chinese characters', () => {
    const raw = '今天吃了一个🍎'
    const encoded = encodeArticleSlug(raw)

    expect(encoded).not.toBe(raw)
    expect(decodeArticleSlug(encoded)).toBe(raw)
  })

  it('returns original string when slug param is malformed encoded text', () => {
    const malformed = '%E0%A4%A'
    expect(decodeArticleSlug(malformed)).toBe(malformed)
  })
})
