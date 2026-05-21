/**
 * `buildMetadata` produces a Next.js 14 `Metadata` object from a small,
 * page-level input shape. Keeps every page's `generateMetadata` short and
 * uniform.
 *
 * Behavior:
 * - `title` is left without the ' | LogWood' suffix; the root layout's
 *   `metadata.title.template` adds it.
 * - `description` is truncated to 160 characters at most.
 * - `path` is required; it produces both the canonical URL and `og:url`.
 * - `image` defaults to the site-level dynamic OG image at `/opengraph-image`.
 * - `type='article'` enables OpenGraph article fields (publishedTime,
 *   modifiedTime).
 * - `noindex=true` emits `robots: { index: false, follow: true, ... }` and
 *   propagates to googleBot. Useful for ephemeral or low-value pages that
 *   nonetheless link to indexable content.
 */
import type { Metadata } from 'next'
import { SITE_LOCALE, SITE_NAME } from './site-config'
import { canonicalFor, toAbsoluteUrl } from './url'

const DEFAULT_OG_PATH = '/opengraph-image'
const DESCRIPTION_LIMIT = 160

export type BuildMetadataInput = {
  title?: string
  description?: string
  path: string
  image?: string | null
  type?: 'website' | 'article'
  publishedTime?: Date | string | null
  modifiedTime?: Date | string | null
  noindex?: boolean
  keywords?: string[]
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const { title, path, image, type = 'website', noindex, keywords } = input
  const description = truncate(input.description, DESCRIPTION_LIMIT)
  const canonical = canonicalFor(path)
  const ogImage = toAbsoluteUrl(image && image.length > 0 ? image : DEFAULT_OG_PATH)

  const robots: Metadata['robots'] = noindex
    ? {
        index: false,
        follow: true,
        googleBot: { index: false, follow: true },
      }
    : undefined

  const openGraph: Metadata['openGraph'] = {
    type,
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    url: canonical,
    title,
    description,
    images: [{ url: ogImage }],
  }

  if (type === 'article') {
    const publishedTime = toIsoString(input.publishedTime)
    const modifiedTime = toIsoString(input.modifiedTime)
    if (publishedTime) (openGraph as Record<string, unknown>).publishedTime = publishedTime
    if (modifiedTime) (openGraph as Record<string, unknown>).modifiedTime = modifiedTime
  }

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots,
  }
}
