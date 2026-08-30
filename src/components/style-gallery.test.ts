import { describe, expect, it } from 'vitest'
import { GALLERY_STYLES } from '@/content/gallery-styles'
import { filterGalleryStyles, toggleGalleryComparison } from './style-gallery'

describe('style gallery helpers', () => {
  it('filters the atlas by visual family without changing the source order', () => {
    const printStyles = filterGalleryStyles(GALLERY_STYLES, 'print')

    expect(printStyles).toHaveLength(6)
    expect(printStyles.every((style) => style.family === 'print')).toBe(true)
    expect(printStyles[0]?.slug).toBe('ukiyo-e')
    expect(filterGalleryStyles(GALLERY_STYLES, 'all')).toBe(GALLERY_STYLES)
  })

  it('adds, removes and caps comparison choices at four', () => {
    expect(toggleGalleryComparison([], 'watercolor')).toEqual(['watercolor'])
    expect(toggleGalleryComparison(['watercolor'], 'watercolor')).toEqual([])

    const full = ['watercolor', 'gouache', 'risograph', 'pixel-art']
    expect(toggleGalleryComparison(full, 'film-noir')).toBe(full)
    expect(toggleGalleryComparison(full, 'gouache')).toEqual([
      'watercolor',
      'risograph',
      'pixel-art',
    ])
  })
})
