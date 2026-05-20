export {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  TWITTER_CARD,
  getSiteUrl,
} from './site-config'

export { toAbsoluteUrl, canonicalFor, joinPath } from './url'

export { buildMetadata } from './metadata'
export type { BuildMetadataInput } from './metadata'

export {
  buildOrganization,
  buildWebSite,
  buildBreadcrumbList,
  buildArticleJsonLd,
  buildSoftwareApplicationJsonLd,
} from './json-ld'
export type {
  JsonLdValue,
  BreadcrumbItem,
  ArticleJsonLdInput,
  SoftwareApplicationJsonLdInput,
} from './json-ld'
