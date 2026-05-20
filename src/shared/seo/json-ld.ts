/**
 * JSON-LD builders for schema.org entities used across LogWood.
 *
 * All builders return plain objects (the `@graph`-friendly shape) so they can
 * be passed directly into the `<JsonLd>` component or composed by callers.
 *
 * Builder rules:
 * - URLs returned are always absolute (via `canonicalFor` / `toAbsoluteUrl`).
 * - `aggregateRating` is only emitted when `reviewCount > 0`.
 * - `BreadcrumbList` positions start at 1.
 * - `WebSite` does NOT include a `SearchAction` until `/search` is implemented;
 *   shipping a broken SearchAction degrades sitelinks SearchBox eligibility.
 */
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from './site-config'
import { canonicalFor, toAbsoluteUrl } from './url'

export type JsonLdValue = Record<string, unknown>

export interface BreadcrumbItem {
  name: string
  /**
   * Relative or absolute. Last item's path is still serialized as `item` for
   * graph completeness, but consumers that prefer the "no link on the leaf"
   * convention can omit it for the trailing entry.
   */
  path?: string | null
}

export interface ArticleJsonLdInput {
  url: string
  title: string
  description?: string | null
  image?: string | null
  publishedAt?: Date | string | null
  updatedAt?: Date | string | null
  author?: { name: string; url?: string } | null
  keywords?: string[]
  articleSection?: string | null
}

export interface SoftwareApplicationJsonLdInput {
  name: string
  description?: string | null
  url: string
  applicationCategory?: string
  operatingSystem?: string
  downloadUrl?: string | null
  sameAs?: string | null
  reviewCount?: number
  ratingValue?: number | null
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

export function buildOrganization(): JsonLdValue {
  const url = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url,
    logo: toAbsoluteUrl('/favicon.svg'),
  }
}

export function buildWebSite(): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    inLanguage: 'zh-CN',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  }
}

export function buildBreadcrumbList(items: BreadcrumbItem[]): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const entry: JsonLdValue = {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
      }
      if (item.path) {
        entry.item = canonicalFor(item.path)
      }
      return entry
    }),
  }
}

export function buildArticleJsonLd(input: ArticleJsonLdInput): JsonLdValue {
  const url = toAbsoluteUrl(input.url)
  const datePublished = toIso(input.publishedAt)
  const dateModified = toIso(input.updatedAt) || datePublished
  const author = input.author
    ? {
        '@type': 'Person',
        name: input.author.name,
        ...(input.author.url ? { url: input.author.url } : {}),
      }
    : { '@type': 'Organization', name: SITE_NAME }

  const result: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    author,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: toAbsoluteUrl('/favicon.svg') },
    },
  }

  if (input.description) result.description = input.description
  if (datePublished) result.datePublished = datePublished
  if (dateModified) result.dateModified = dateModified
  if (input.image) result.image = [toAbsoluteUrl(input.image)]
  if (input.keywords && input.keywords.length > 0) result.keywords = input.keywords.join(', ')
  if (input.articleSection) result.articleSection = input.articleSection

  return result
}

export function buildSoftwareApplicationJsonLd(input: SoftwareApplicationJsonLdInput): JsonLdValue {
  const url = toAbsoluteUrl(input.url)
  const result: JsonLdValue = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: input.name,
    url,
    applicationCategory: input.applicationCategory ?? 'DeveloperApplication',
  }

  if (input.description) result.description = input.description
  if (input.operatingSystem) result.operatingSystem = input.operatingSystem
  if (input.downloadUrl) result.downloadUrl = input.downloadUrl
  if (input.sameAs) result.sameAs = input.sameAs

  if (typeof input.reviewCount === 'number' && input.reviewCount > 0 && typeof input.ratingValue === 'number') {
    result.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.round(input.ratingValue * 10) / 10,
      bestRating: 5,
      worstRating: 1,
      reviewCount: input.reviewCount,
    }
  }

  return result
}
