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
  '空心树洞是灵感淘洗与经验沉淀系统：收住零散灵感，经过观察和判断进入收藏室或废品站，同时保存吐槽、证据和长期笔记。'

export const SITE_KEYWORDS: string[] = [
  '空心树洞',
  'AI Skill',
  '收藏室',
  '废品站',
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
