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

export const SITE_NAME = '空心树洞'

export const SITE_TAGLINE = '放下执念，重新生长'

export const SITE_DESCRIPTION =
  '空心树洞——收藏 Skill、展览美图与示例站，并用 AI 帮你把灵感重新生长成可对比、可复用的内容。'

export const SITE_KEYWORDS: string[] = [
  '空心树洞',
  'Skill 库',
  '前端 Skill',
  '图片风格',
  '灵感画廊',
  '示例网站',
  '创意展览',
  'AI 创作',
  '效果图对比',
  '个人策展',
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
