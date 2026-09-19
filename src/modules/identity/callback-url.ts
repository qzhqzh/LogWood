function isInternalPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}

export function sanitizeCallbackUrl(raw: string | null | undefined, fallback: string = '/articles/manage'): string {
  if (!raw || !raw.trim()) {
    return fallback
  }

  const value = raw.trim()

  // Keep relative paths inside the same site.
  if (isInternalPath(value)) {
    return value
  }

  try {
    const parsed = new URL(value)
    if (!['https:', 'http:'].includes(parsed.protocol) || !isInternalPath(parsed.pathname)) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
