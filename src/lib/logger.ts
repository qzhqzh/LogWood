/**
 * Tiny structured logger built on top of `console`.
 *
 * Why not pino/winston: those are great but bring runtime + bundle weight.
 * For LogWood's current size, a JSON-line wrapper around `console` is enough
 * to (a) make logs grep-able and (b) attach a request id for correlation.
 *
 * Levels are gated by the `LOG_LEVEL` env (default `info` in production,
 * `debug` otherwise). Each call emits a single line of JSON.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('article.created', { id, slug })
 *   logger.error('upload.failed', { err: error.message })
 *
 * Pair with `withApiError` (src/lib/api-handlers.ts) for request-scoped logs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const DEFAULT_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

function resolveMinLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase()
  if (raw in LEVEL_RANK) return raw as LogLevel
  return DEFAULT_LEVEL
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[resolveMinLevel()]
}

function emit(level: LogLevel, msg: string, context?: Record<string, unknown>) {
  if (!shouldEmit(level)) return

  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  }

  // Route warn/error to stderr so they show up in container error streams,
  // info/debug to stdout. JSON.stringify is intentional (no circular ref
  // tolerance — callers should pass plain context objects).
  const line = JSON.stringify(payload)
  if (level === 'error' || level === 'warn') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  debug(msg: string, context?: Record<string, unknown>) {
    emit('debug', msg, context)
  },
  info(msg: string, context?: Record<string, unknown>) {
    emit('info', msg, context)
  },
  warn(msg: string, context?: Record<string, unknown>) {
    emit('warn', msg, context)
  },
  error(msg: string, context?: Record<string, unknown>) {
    emit('error', msg, context)
  },
  /**
   * Returns a logger bound to a fixed context (e.g. requestId, route). All
   * calls on the returned object include the bound fields.
   */
  child(boundContext: Record<string, unknown>) {
    return {
      debug: (msg: string, c?: Record<string, unknown>) => emit('debug', msg, { ...boundContext, ...c }),
      info: (msg: string, c?: Record<string, unknown>) => emit('info', msg, { ...boundContext, ...c }),
      warn: (msg: string, c?: Record<string, unknown>) => emit('warn', msg, { ...boundContext, ...c }),
      error: (msg: string, c?: Record<string, unknown>) => emit('error', msg, { ...boundContext, ...c }),
    }
  },
}

export type Logger = typeof logger
