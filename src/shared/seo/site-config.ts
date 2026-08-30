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

export const SITE_TAGLINE = '可验证的提示词仓库'

export const SITE_DESCRIPTION =
  '空心树洞保存可执行提示词、真实效果、来源、AI 归属与验证记录；AI 负责协作草稿，人负责公开门禁。'

export const SITE_KEYWORDS: string[] = [
  '空心树洞',
  'AI Skill',
  '提示词仓库',
  'Prompt Library',
  '提示词',
  'Prompt',
  'AI 工作流',
  '模型评测',
  '软件评测',
  '资源评测',
  '提示词对比',
  '可审计创作',
  '技术小结',
  '可复用模板',
  '人机协作',
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
