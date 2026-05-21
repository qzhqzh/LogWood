/**
 * URL helpers for SEO. All helpers are pure and synchronous so they can be
 * called from server components, route handlers, sitemap.ts, and tests.
 */
import { getSiteUrl } from './site-config'

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function ensureLeadingSlash(value: string): string {
  if (value.length === 0) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

function stripTrailingSlash(value: string): string {
  if (value === '/') return value
  return value.replace(/\/+$/, '')
}

/**
 * Convert any path or partial URL to an absolute URL.
 * If the input is already absolute, it is returned unchanged.
 */
export function toAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return getSiteUrl()
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl
  return `${getSiteUrl()}${ensureLeadingSlash(pathOrUrl)}`
}

/**
 * Canonical URL for a given path. Strips trailing slashes (except root).
 * Idempotent for absolute URLs.
 */
export function canonicalFor(path: string): string {
  if (!path || path === '/') return getSiteUrl()
  if (isAbsoluteUrl(path)) return stripTrailingSlash(path)
  return `${getSiteUrl()}${stripTrailingSlash(ensureLeadingSlash(path))}`
}

/**
 * Join URL/path segments without producing duplicate or missing slashes.
 * Empty segments are ignored. Always returns a path starting with `/`.
 */
export function joinPath(...segments: Array<string | number | null | undefined>): string {
  const cleaned = segments
    .filter((s): s is string | number => s !== null && s !== undefined && s !== '')
    .map((s) => String(s).replace(/^\/+|\/+$/g, ''))
    .filter((s) => s.length > 0)

  if (cleaned.length === 0) return '/'
  return `/${cleaned.join('/')}`
}
