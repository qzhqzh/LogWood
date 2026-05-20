import { describe, expect, it } from 'vitest'
import { parsePage, parsePageSize, parsePositiveInt, parseSearchKeyword } from './safe-parse'

describe('lib/safe-parse', () => {
  describe('parsePositiveInt', () => {
    it('returns parsed int when within range', () => {
      expect(parsePositiveInt('5', { default: 1, max: 10 })).toBe(5)
    })

    it('falls back to default when input is not a number', () => {
      expect(parsePositiveInt('abc', { default: 1, max: 10 })).toBe(1)
      expect(parsePositiveInt(undefined, { default: 1, max: 10 })).toBe(1)
      expect(parsePositiveInt(null, { default: 1, max: 10 })).toBe(1)
    })

    it('falls back to default on negative or zero values', () => {
      expect(parsePositiveInt('-5', { default: 7, max: 10 })).toBe(7)
      expect(parsePositiveInt('0', { default: 7, max: 10 })).toBe(7)
    })

    it('clamps to max when input exceeds it', () => {
      expect(parsePositiveInt('500', { default: 1, max: 100 })).toBe(100)
    })

    it('respects min override', () => {
      expect(parsePositiveInt('3', { default: 5, max: 10, min: 5 })).toBe(5)
    })
  })

  describe('parsePage', () => {
    it('defaults to 1', () => {
      expect(parsePage(undefined)).toBe(1)
    })

    it('caps at 10000', () => {
      expect(parsePage('999999')).toBe(10_000)
    })
  })

  describe('parsePageSize', () => {
    it('defaults to 20 and caps at 100', () => {
      expect(parsePageSize(undefined)).toBe(20)
      expect(parsePageSize('999')).toBe(100)
    })

    it('honours per-call default and max overrides', () => {
      expect(parsePageSize('40', { default: 12, max: 50 })).toBe(40)
      expect(parsePageSize('80', { default: 12, max: 50 })).toBe(50)
    })
  })

  describe('parseSearchKeyword', () => {
    it('returns trimmed string when present', () => {
      expect(parseSearchKeyword('  hello world  ')).toBe('hello world')
    })

    it('returns undefined for empty/whitespace/non-string', () => {
      expect(parseSearchKeyword('')).toBeUndefined()
      expect(parseSearchKeyword('   ')).toBeUndefined()
      expect(parseSearchKeyword(null)).toBeUndefined()
      expect(parseSearchKeyword(undefined)).toBeUndefined()
    })

    it('caps to maxLength', () => {
      const long = 'a'.repeat(200)
      expect(parseSearchKeyword(long, 80)).toHaveLength(80)
    })
  })
})
