import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GALLERY_FAMILIES,
  GALLERY_PROVENANCE,
  GALLERY_STYLES,
  galleryPromptFor,
} from './gallery-styles'

describe('gallery style atlas', () => {
  it('keeps a balanced, uniquely addressable 36-style seed set', () => {
    expect(GALLERY_STYLES).toHaveLength(36)
    expect(new Set(GALLERY_STYLES.map((style) => style.slug)).size).toBe(36)
    expect(new Set(GALLERY_STYLES.map((style) => style.imageUrl)).size).toBe(36)

    for (const family of GALLERY_FAMILIES) {
      expect(GALLERY_STYLES.filter((style) => style.family === family.id)).toHaveLength(6)
    }
  })

  it('ships every referenced example as a WebP project asset', () => {
    for (const style of GALLERY_STYLES) {
      const filePath = path.join(process.cwd(), 'public', style.imageUrl)
      expect(existsSync(filePath), `${style.slug} is missing`).toBe(true)
      expect(readFileSync(filePath).subarray(0, 4).toString('ascii')).toBe('RIFF')
    }
  })

  it('keeps useful recipes, observation copy and explicit synthetic provenance', () => {
    for (const style of GALLERY_STYLES) {
      expect(style.title).toBeTruthy()
      expect(style.titleZh).toBeTruthy()
      expect(style.medium).toBeTruthy()
      expect(style.effect.length).toBeGreaterThan(20)
      expect(style.promptFragment.length).toBeGreaterThan(20)
      expect(style.cues).toHaveLength(3)
      expect(galleryPromptFor(style)).toContain(style.promptFragment)
      expect(galleryPromptFor(style)).toContain('no text, logo, signature or watermark')
    }

    expect(GALLERY_PROVENANCE.status).toContain('UNVERIFIED')
    expect(GALLERY_PROVENANCE.modelVersion).toBe('not exposed')
    expect(GALLERY_PROVENANCE.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(GALLERY_PROVENANCE.rights).toContain('PENDING')
  })
})
