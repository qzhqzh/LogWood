import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_TRUST = process.env.LOGWOOD_TRUST_PROXY
const ORIGINAL_SECRET = process.env.LOGWOOD_IP_HASH_SECRET

function makeHeaders(init: Record<string, string>): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(init)) headers.set(key, value)
  return headers
}

async function loadIpModule({
  trustProxy,
  hmacSecret,
}: {
  trustProxy?: string
  hmacSecret?: string
} = {}) {
  if (trustProxy === undefined) delete process.env.LOGWOOD_TRUST_PROXY
  else process.env.LOGWOOD_TRUST_PROXY = trustProxy

  if (hmacSecret === undefined) delete process.env.LOGWOOD_IP_HASH_SECRET
  else process.env.LOGWOOD_IP_HASH_SECRET = hmacSecret

  vi.resetModules()
  return import('./ip')
}

describe('lib/ip', () => {
  beforeEach(() => {
    delete process.env.LOGWOOD_TRUST_PROXY
    delete process.env.LOGWOOD_IP_HASH_SECRET
    vi.resetModules()
  })

  afterEach(() => {
    if (ORIGINAL_TRUST === undefined) delete process.env.LOGWOOD_TRUST_PROXY
    else process.env.LOGWOOD_TRUST_PROXY = ORIGINAL_TRUST

    if (ORIGINAL_SECRET === undefined) delete process.env.LOGWOOD_IP_HASH_SECRET
    else process.env.LOGWOOD_IP_HASH_SECRET = ORIGINAL_SECRET

    vi.resetModules()
  })

  describe('getClientIp', () => {
    it('refuses to read forwarded headers when proxy is not trusted', async () => {
      const { getClientIp } = await loadIpModule({ trustProxy: 'false' })
      const ip = getClientIp(makeHeaders({ 'x-forwarded-for': '1.2.3.4' }))
      expect(ip).toBe('unknown')
    })

    it('reads x-forwarded-for first when proxy is trusted', async () => {
      const { getClientIp } = await loadIpModule({ trustProxy: 'true' })
      const ip = getClientIp(
        makeHeaders({
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
          'x-real-ip': '9.9.9.9',
        }),
      )
      expect(ip).toBe('1.2.3.4')
    })

    it('falls back to x-real-ip when xff is missing', async () => {
      const { getClientIp } = await loadIpModule({ trustProxy: 'true' })
      const ip = getClientIp(makeHeaders({ 'x-real-ip': '9.9.9.9' }))
      expect(ip).toBe('9.9.9.9')
    })

    it('returns unknown when both headers are missing', async () => {
      const { getClientIp } = await loadIpModule({ trustProxy: 'true' })
      const ip = getClientIp(makeHeaders({}))
      expect(ip).toBe('unknown')
    })
  })

  describe('hashIp', () => {
    it('produces a 16-char hex token', async () => {
      const { hashIp } = await loadIpModule()
      expect(hashIp('1.2.3.4')).toMatch(/^[0-9a-f]{16}$/)
    })

    it('is deterministic for the same IP and secret', async () => {
      const { hashIp } = await loadIpModule({ hmacSecret: 'stable-secret' })
      expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
    })

    it('differs across secrets after process-level config reload', async () => {
      const firstModule = await loadIpModule({ hmacSecret: 'first' })
      const first = firstModule.hashIp('1.2.3.4')

      const secondModule = await loadIpModule({ hmacSecret: 'second' })
      const second = secondModule.hashIp('1.2.3.4')

      expect(first).not.toBe(second)
    })
  })
})
