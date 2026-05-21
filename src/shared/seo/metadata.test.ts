import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildMetadata } from './metadata'

const ORIGINAL = process.env.SITE_URL

describe('shared/seo/metadata', () => {
  beforeEach(() => {
    process.env.SITE_URL = 'https://logwood.test'
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = ORIGINAL
  })

  it('produces canonical absolute URL', () => {
    const meta = buildMetadata({ title: 'X', description: 'Y', path: '/articles/foo' })
    expect(meta.alternates?.canonical).toBe('https://logwood.test/articles/foo')
    expect((meta.openGraph as any)?.url).toBe('https://logwood.test/articles/foo')
  })

  it('truncates description to 160 characters', () => {
    const long = '一'.repeat(220)
    const meta = buildMetadata({ description: long, path: '/' })
    expect(meta.description).toBeDefined()
    expect((meta.description as string).length).toBeLessThanOrEqual(160)
  })

  it('falls back to site-level OG image when none provided', () => {
    const meta = buildMetadata({ path: '/' })
    const images = (meta.openGraph as any)?.images
    expect(Array.isArray(images)).toBe(true)
    expect(images[0].url).toBe('https://logwood.test/opengraph-image')
  })

  it('uses provided image when supplied (absolute output)', () => {
    const meta = buildMetadata({ path: '/articles/foo', image: '/uploads/cover.png' })
    const images = (meta.openGraph as any)?.images
    expect(images[0].url).toBe('https://logwood.test/uploads/cover.png')
  })

  it('emits noindex robots when noindex=true', () => {
    const meta = buildMetadata({ path: '/auth/signin', noindex: true })
    expect((meta.robots as any)?.index).toBe(false)
    expect((meta.robots as any)?.googleBot?.index).toBe(false)
  })

  it('emits article fields for type=article', () => {
    const meta = buildMetadata({
      title: 'My Post',
      path: '/articles/foo',
      type: 'article',
      publishedTime: new Date('2026-01-02T03:04:05Z'),
      modifiedTime: new Date('2026-02-03T04:05:06Z'),
    })
    const og = meta.openGraph as any
    expect(og.type).toBe('article')
    expect(og.publishedTime).toBe('2026-01-02T03:04:05.000Z')
    expect(og.modifiedTime).toBe('2026-02-03T04:05:06.000Z')
  })

  it('omits publishedTime/modifiedTime for type=website', () => {
    const meta = buildMetadata({
      path: '/',
      publishedTime: new Date('2026-01-02T03:04:05Z'),
    })
    const og = meta.openGraph as any
    expect(og.publishedTime).toBeUndefined()
  })

  it('always emits Twitter summary_large_image card', () => {
    const meta = buildMetadata({ title: 'X', path: '/' })
    expect((meta.twitter as any)?.card).toBe('summary_large_image')
  })
})
