/**
 * Site-wide SEO constants and resolved site URL helper.
 *
 * `getSiteUrl()` resolution order:
 *   1. `process.env.SITE_URL`     (preferred, dedicated public URL)
 *   2. `process.env.NEXTAUTH_URL` (existing fallback for legacy deployments)
 *   3. `'https://logwood.app'`    (last-resort default)
 *
 * The returned URL never has a trailing slash, so it is safe to concatenate
 * with paths that always start with `/`.
 */

export const SITE_NAME = 'LogWood'

export const SITE_DESCRIPTION =
  '专注于 AI Coding 生态的评测社区，统一收录 AI Editor、AI Coding、AI Model 与 AI Prompt 工具和实践内容'

export const SITE_KEYWORDS: string[] = [
  'AI编码工具',
  'AI编程',
  'AI代码评测',
  'AI Editor',
  'AI Coding',
  'Claude',
  'Cursor',
  'Copilot',
  'Prompt工具',
  'AI Model',
]

export const SITE_LOCALE = 'zh_CN'

export const TWITTER_CARD = 'summary_large_image' as const

const DEFAULT_SITE_URL = 'https://logwood.app'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function getSiteUrl(): string {
  const candidate = process.env.SITE_URL || process.env.NEXTAUTH_URL || DEFAULT_SITE_URL
  return stripTrailingSlash(candidate)
}
