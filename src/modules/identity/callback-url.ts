const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export function sanitizeCallbackUrl(raw: string | null | undefined, fallback: string = '/articles/manage'): string {
  if (!raw || !raw.trim()) {
    return fallback
  }

  const value = raw.trim()

  // Keep relative paths inside the same site.
  if (value.startsWith('/')) {
    return value
  }

  try {
    const parsed = new URL(value)
    if (LOCAL_HOSTS.has(parsed.hostname)) {
      return fallback
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback
  } catch {
    return fallback
  }
}
