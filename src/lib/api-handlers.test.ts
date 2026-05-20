import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { withApiError } from './api-handlers'

// Suppress logger output during tests; the wrapper logs unhandled errors.
const originalConsoleError = console.error
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.log = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
})

describe('lib/api-handlers withApiError', () => {
  it('passes successful responses through untouched', async () => {
    const handler = withApiError('test.success', async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    const res = await handler()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('maps ZodError to 400 with details and a requestId', async () => {
    const schema = z.object({ name: z.string().min(3) })
    const handler = withApiError('test.zod', async () => {
      schema.parse({ name: 'a' })
      return new Response('unreachable', { status: 200 })
    })

    const res = await handler()
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string; details: unknown[]; requestId: string }
    expect(body.error).toBe('ERR_VALIDATION')
    expect(Array.isArray(body.details)).toBe(true)
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('maps ERR_RATE_LIMIT_EXCEEDED to 429', async () => {
    const handler = withApiError('test.ratelimit', async () => {
      throw new Error('ERR_RATE_LIMIT_EXCEEDED')
    })

    const res = await handler()
    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('ERR_RATE_LIMIT_EXCEEDED')
  })

  it('maps *_NOT_FOUND suffix to 404', async () => {
    const handler = withApiError('test.notfound', async () => {
      throw new Error('ERR_REVIEW_NOT_FOUND')
    })

    const res = await handler()
    expect(res.status).toBe(404)
  })

  it('maps *_VALIDATION suffix to 400', async () => {
    const handler = withApiError('test.validation', async () => {
      throw new Error('ERR_REPORT_VALIDATION')
    })

    const res = await handler()
    expect(res.status).toBe(400)
  })

  it('maps ERR_FORBIDDEN to 403 and ERR_UNAUTHORIZED to 401', async () => {
    const forbidden = withApiError('test.forbidden', async () => {
      throw new Error('ERR_FORBIDDEN')
    })
    const unauth = withApiError('test.unauth', async () => {
      throw new Error('ERR_UNAUTHORIZED')
    })

    expect((await forbidden()).status).toBe(403)
    expect((await unauth()).status).toBe(401)
  })

  it('returns 500 with internal-server-error body for unknown errors', async () => {
    const handler = withApiError('test.unknown', async () => {
      throw new Error('something exploded with details')
    })

    const res = await handler()
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Internal server error')
    // Crucially, the internal error message must NOT leak.
    expect(body.error).not.toContain('exploded')
  })

  it('honours errorStatusOverrides for custom mapping', async () => {
    const handler = withApiError(
      'test.custom',
      async () => {
        throw new Error('ERR_REVIEW_NOT_FOUND')
      },
      { errorStatusOverrides: { ERR_REVIEW_NOT_FOUND: 410 } },
    )

    const res = await handler()
    expect(res.status).toBe(410)
  })
})
