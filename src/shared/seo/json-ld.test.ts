import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  buildArticleJsonLd,
  buildBreadcrumbList,
  buildOrganization,
  buildSoftwareApplicationJsonLd,
  buildWebSite,
} from './json-ld'

const ORIGINAL = process.env.SITE_URL

const ListItemSchema = z.object({
  '@type': z.literal('ListItem'),
  position: z.number().int().positive(),
  name: z.string(),
  item: z.string().url().optional(),
})

const BreadcrumbListSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('BreadcrumbList'),
  itemListElement: z.array(ListItemSchema).min(1),
})

const BlogPostingSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('BlogPosting'),
  headline: z.string(),
  url: z.string().url(),
  mainEntityOfPage: z.object({
    '@type': z.literal('WebPage'),
    '@id': z.string().url(),
  }),
  author: z.object({ '@type': z.string(), name: z.string() }),
  publisher: z.object({
    '@type': z.literal('Organization'),
    name: z.string(),
    logo: z.object({ '@type': z.literal('ImageObject'), url: z.string().url() }),
  }),
  datePublished: z.string().optional(),
  dateModified: z.string().optional(),
  description: z.string().optional(),
  image: z.array(z.string().url()).optional(),
  keywords: z.string().optional(),
  articleSection: z.string().optional(),
})

const SoftwareApplicationSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('SoftwareApplication'),
  name: z.string(),
  url: z.string().url(),
  applicationCategory: z.string(),
  description: z.string().optional(),
  downloadUrl: z.string().optional(),
  sameAs: z.string().optional(),
  aggregateRating: z
    .object({
      '@type': z.literal('AggregateRating'),
      ratingValue: z.number(),
      bestRating: z.literal(5),
      worstRating: z.literal(1),
      reviewCount: z.number().int().positive(),
    })
    .optional(),
})

describe('shared/seo/json-ld', () => {
  beforeEach(() => {
    process.env.SITE_URL = 'https://logwood.test'
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = ORIGINAL
  })

  describe('buildOrganization', () => {
    it('emits an Organization with absolute logo and url', () => {
      const org = buildOrganization() as Record<string, unknown>
      expect(org['@type']).toBe('Organization')
      expect(org.url).toBe('https://logwood.test')
      expect(org.logo).toBe('https://logwood.test/favicon.svg')
    })
  })

  describe('buildWebSite', () => {
    it('does NOT include a SearchAction (search is not implemented yet)', () => {
      const site = buildWebSite() as Record<string, unknown>
      expect(site.potentialAction).toBeUndefined()
      expect(site['@type']).toBe('WebSite')
      expect(site.url).toBe('https://logwood.test')
      expect(site.inLanguage).toBe('zh-CN')
    })
  })

  describe('buildBreadcrumbList', () => {
    it('numbers positions starting from 1 and resolves absolute URLs', () => {
      const result = buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: '社区文章', path: '/articles' },
        { name: '某文章' },
      ])
      const parsed = BreadcrumbListSchema.parse(result)
      expect(parsed.itemListElement[0].position).toBe(1)
      expect(parsed.itemListElement[1].position).toBe(2)
      expect(parsed.itemListElement[2].position).toBe(3)
      expect(parsed.itemListElement[1].item).toBe('https://logwood.test/articles')
      expect(parsed.itemListElement[2].item).toBeUndefined()
    })
  })

  describe('buildArticleJsonLd', () => {
    it('produces a BlogPosting with absolute URLs and ISO dates', () => {
      const result = buildArticleJsonLd({
        url: '/articles/foo',
        title: 'Foo',
        description: '一段摘要',
        image: '/uploads/cover.png',
        publishedAt: new Date('2026-01-02T03:04:05Z'),
        updatedAt: new Date('2026-02-03T04:05:06Z'),
        author: { name: '作者' },
        keywords: ['ai', 'coding'],
        articleSection: 'vibe coding',
      })
      const parsed = BlogPostingSchema.parse(result)
      expect(parsed.url).toBe('https://logwood.test/articles/foo')
      expect(parsed.datePublished).toBe('2026-01-02T03:04:05.000Z')
      expect(parsed.dateModified).toBe('2026-02-03T04:05:06.000Z')
      expect(parsed.image).toEqual(['https://logwood.test/uploads/cover.png'])
      expect(parsed.keywords).toBe('ai, coding')
      expect(parsed.articleSection).toBe('vibe coding')
    })

    it('uses Organization author fallback when none provided', () => {
      const result = buildArticleJsonLd({
        url: '/articles/foo',
        title: 'Foo',
      }) as Record<string, any>
      expect(result.author['@type']).toBe('Organization')
    })
  })

  describe('buildSoftwareApplicationJsonLd', () => {
    it('emits aggregateRating only when reviewCount > 0', () => {
      const without = buildSoftwareApplicationJsonLd({
        name: 'Cursor',
        url: '/editor/cursor',
        reviewCount: 0,
        ratingValue: 4.5,
      })
      expect((without as Record<string, unknown>).aggregateRating).toBeUndefined()

      const withRating = buildSoftwareApplicationJsonLd({
        name: 'Cursor',
        description: 'AI editor',
        url: '/editor/cursor',
        reviewCount: 12,
        ratingValue: 4.555,
      })
      const parsed = SoftwareApplicationSchema.parse(withRating)
      expect(parsed.aggregateRating?.reviewCount).toBe(12)
      expect(parsed.aggregateRating?.ratingValue).toBe(4.6)
    })

    it('passes through applicationCategory and downloadUrl', () => {
      const result = buildSoftwareApplicationJsonLd({
        name: 'Some App',
        url: '/app/some',
        applicationCategory: 'WebApplication',
        downloadUrl: 'https://example.com/app',
      })
      const parsed = SoftwareApplicationSchema.parse(result)
      expect(parsed.applicationCategory).toBe('WebApplication')
      expect(parsed.downloadUrl).toBe('https://example.com/app')
    })
  })
})
