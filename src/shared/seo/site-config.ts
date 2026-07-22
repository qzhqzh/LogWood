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

export const SITE_TAGLINE = '大浪淘沙，找寻灵感'

export const SITE_DESCRIPTION =
  '空心树洞是 AI 灵感炼成与实践沉淀社区：把灵感与资源经过试用、评测和打磨，沉淀为可复用的模板、提示词、工作流与 Skill，同时保存吐槽、失败和技术反思。'

export const SITE_KEYWORDS: string[] = [
  '空心树洞',
  'AI Skill',
  'Skill 库',
  '提示词',
  'Prompt',
  'AI 工作流',
  '模型评测',
  '软件评测',
  '资源评测',
  '灵感池',
  '吐槽室',
  '技术小结',
  '可复用模板',
  'AI 实践社区',
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
