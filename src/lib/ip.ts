/**
 * Client IP resolution and keyed hashing.
 *
 * Two security concerns this file addresses:
 *
 * 1. **Spoofable proxy headers (R-01).** `x-forwarded-for` and `x-real-ip` are
 *    only trustworthy when we sit behind a reverse proxy that strips/sets
 *    these headers ourselves. If the app is reachable directly (or behind a
 *    proxy that doesn't sanitize), a client can set these headers freely and
 *    bypass IP-based rate limits. We require explicit opt-in via the
 *    `LOGWOOD_TRUST_PROXY` env var; otherwise we don't read those headers.
 *
 * 2. **IP hash that doubles as IP lookup (R-01).** The previous non-keyed
 *    hash let anyone recompute hashes for arbitrary IPs and de-anonymise the
 *    rate-limit table. We now use HMAC-SHA-256 with `LOGWOOD_IP_HASH_SECRET`,
 *    so without the secret an attacker cannot link a hash back to an IP.
 *
 * Both env vars are documented in `.env.example`.
 */
import crypto from 'node:crypto'

const TRUST_PROXY = process.env.LOGWOOD_TRUST_PROXY === 'true'
const HMAC_SECRET = process.env.LOGWOOD_IP_HASH_SECRET || ''

let warnedNoSecret = false

/**
 * Pick the first non-empty client IP from request headers, only when the
 * deployment has explicitly opted in to trusting proxy headers.
 */
export function getClientIp(headersList: Headers): string {
  if (TRUST_PROXY) {
    const forwarded = headersList.get('x-forwarded-for')
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim()
      if (first) return first
    }
    const real = headersList.get('x-real-ip')?.trim()
    if (real) return real
  }
  // Untrusted proxy or direct exposure: do not read forwarded-for to avoid
  // spoofing. Bucketing every direct hit under "unknown" effectively means
  // IP-segment limits are loose for those flows, but at least they cannot be
  // bypassed by setting an attacker-controlled header.
  return 'unknown'
}

/**
 * Hash an IP into an opaque short token suitable for rate-limit actor keys.
 * When `LOGWOOD_IP_HASH_SECRET` is set we use HMAC-SHA-256; otherwise we
 * fall back to plain SHA-256 and warn once in production.
 */
export function hashIp(ip: string): string {
  if (!HMAC_SECRET) {
    if (!warnedNoSecret && process.env.NODE_ENV === 'production') {
      console.warn(
        'LOGWOOD_IP_HASH_SECRET is not set; falling back to non-keyed SHA-256. ' +
          'Set this env in production for stronger IP anonymisation.',
      )
      warnedNoSecret = true
    }
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
  }
  return crypto.createHmac('sha256', HMAC_SECRET).update(ip).digest('hex').slice(0, 16)
}
