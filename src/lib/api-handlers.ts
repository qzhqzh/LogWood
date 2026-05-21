/**
 * Standardised error handling for App Router route handlers.
 *
 * Without this, every route hand-rolls the same try/catch with the same
 * mapping of `ERR_*` strings to HTTP status codes; the resulting copy-paste
 * tends to drift (some routes log stack traces, some don't; some leak the
 * error message, some don't). `withApiError` centralises that logic.
 *
 * **Adoption policy:** new routes should use `withApiError`. Existing routes
 * keep their hand-rolled handlers for now to avoid a churny refactor in this
 * PR; migrating them is mechanical and can be done opportunistically.
 *
 * Usage:
 *   export const POST = withApiError('reviews.create', async (request) => {
 *     const body = await request.json()
 *     const validated = schema.parse(body)
 *     const result = await createReview(validated, actor)
 *     return NextResponse.json(result, { status: 201 })
 *   })
 */
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { ZodError } from 'zod'
import { logger } from './logger'

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<Response | NextResponse>

export interface ApiErrorMapping {
  /**
   * Maps `ERR_*` codes to HTTP status. Anything not listed here defaults
   * based on the heuristic in `inferStatusFromCode`.
   */
  errorStatusOverrides?: Record<string, number>
}

const DEFAULT_KNOWN_CODES: Record<string, number> = {
  ERR_UNAUTHORIZED: 401,
  ERR_FORBIDDEN: 403,
  ERR_RATE_LIMIT_EXCEEDED: 429,
  ERR_DEVICE_FINGERPRINT_INVALID: 400,
}

function inferStatusFromCode(code: string): number {
  if (DEFAULT_KNOWN_CODES[code]) return DEFAULT_KNOWN_CODES[code]
  if (code.endsWith('_NOT_FOUND')) return 404
  if (code.endsWith('_VALIDATION')) return 400
  if (code.endsWith('_INVALID')) return 400
  if (code.endsWith('_REQUIRED')) return 400
  return 500
}

function isErrCode(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('ERR_')
}

/**
 * Wrap a route handler with uniform error handling and per-request logging.
 *
 * The first argument is a handler tag (used as a log message prefix); the
 * second is the actual handler. Generic over the Args tuple so it preserves
 * Next.js's `(request, { params })` signature.
 */
export function withApiError<Args extends unknown[]>(
  tag: string,
  handler: RouteHandler<Args>,
  mapping: ApiErrorMapping = {}
): RouteHandler<Args> {
  return async (...args: Args): Promise<Response | NextResponse> => {
    const requestId = randomUUID()
    const log = logger.child({ requestId, route: tag })

    try {
      return await handler(...args)
    } catch (error) {
      // Validation errors from zod: surface details to the client so the
      // form can show field-specific messages.
      if (error instanceof ZodError) {
        log.warn('validation_failed', { issues: error.errors.length })
        return NextResponse.json(
          {
            error: 'ERR_VALIDATION',
            details: error.errors,
            requestId,
          },
          { status: 400 },
        )
      }

      // Business errors: codes start with ERR_ and map to known statuses.
      if (error instanceof Error && isErrCode(error.message)) {
        const code = error.message
        const status = mapping.errorStatusOverrides?.[code] ?? inferStatusFromCode(code)
        if (status >= 500) {
          log.error('handler_business_error', { code, status })
        } else {
          log.warn('handler_business_error', { code, status })
        }
        return NextResponse.json(
          { error: code, requestId },
          { status },
        )
      }

      // Unknown failure: log with stack but never leak to the client.
      log.error('handler_unhandled_error', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return NextResponse.json(
        { error: 'Internal server error', requestId },
        { status: 500 },
      )
    }
  }
}
