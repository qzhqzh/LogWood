export function encodeArticleSlug(slug: string): string {
  return encodeURIComponent(slug)
}

export function decodeArticleSlug(slugParam: string): string {
  try {
    return decodeURIComponent(slugParam)
  } catch {
    return slugParam
  }
}
