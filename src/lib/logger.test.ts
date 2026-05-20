import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from './logger'

const ORIGINAL_LEVEL = process.env.LOG_LEVEL
const ORIGINAL_NODE_ENV = process.env.NODE_ENV

const originalLog = console.log
const originalErr = console.error

let logSpy: ReturnType<typeof vi.fn>
let errSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  logSpy = vi.fn()
  errSpy = vi.fn()
  console.log = logSpy
  console.error = errSpy
  delete process.env.LOG_LEVEL
})

afterEach(() => {
  console.log = originalLog
  console.error = originalErr
  if (ORIGINAL_LEVEL === undefined) delete process.env.LOG_LEVEL
  else process.env.LOG_LEVEL = ORIGINAL_LEVEL
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV
})

function lastJson(spy: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const last = spy.mock.calls.at(-1)?.[0]
  return JSON.parse(String(last))
}

describe('lib/logger', () => {
  it('emits info on stdout with JSON shape', () => {
    process.env.LOG_LEVEL = 'info'
    logger.info('hello', { a: 1 })

    expect(logSpy).toHaveBeenCalledTimes(1)
    const payload = lastJson(logSpy)
    expect(payload.level).toBe('info')
    expect(payload.msg).toBe('hello')
    expect(payload.context).toEqual({ a: 1 })
    expect(typeof payload.ts).toBe('string')
  })

  it('emits warn and error to stderr', () => {
    process.env.LOG_LEVEL = 'debug'
    logger.warn('careful', { x: 1 })
    logger.error('boom', { y: 2 })

    expect(errSpy).toHaveBeenCalledTimes(2)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('filters debug below info level', () => {
    process.env.LOG_LEVEL = 'info'
    logger.debug('quiet')
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('child(boundContext) merges context into every emit', () => {
    process.env.LOG_LEVEL = 'debug'
    const child = logger.child({ requestId: 'abc' })
    child.info('msg', { extra: true })

    const payload = lastJson(logSpy)
    expect(payload.context).toEqual({ requestId: 'abc', extra: true })
  })

  it('omits the context key when no context is provided', () => {
    process.env.LOG_LEVEL = 'debug'
    logger.info('plain')

    const payload = lastJson(logSpy)
    expect('context' in payload).toBe(false)
  })
})
