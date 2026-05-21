/**
 * Tiny helpers to parse query-string numbers safely.
 *
 * Why: route handlers were doing `parseInt(searchParams.get('page') || '1')`,
 * which silently turns garbage like `?page=abc` into `NaN`. `NaN` then flows
 * into Prisma's `skip`/`take` and surfaces as a 500 with a confusing message
 * (or worse, a wildly large allocation if a positive `Infinity`-like value
 * sneaks in via floats). These helpers force a sane default and clamp to a
 * maximum, returning a finite integer.
 */

export interface PositiveIntOptions {
  default: number
  max?: number
  min?: number
}

export function parsePositiveInt(value: unknown, options: PositiveIntOptions): number {
  const { default: fallback, max, min = 1 } = options
  const raw = typeof value === 'string' ? value : ''
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < min) return fallback
  if (typeof max === 'number' && parsed > max) return max
  return parsed
}

export function parsePage(value: unknown, options: { default?: number; max?: number } = {}): number {
  return parsePositiveInt(value, {
    default: options.default ?? 1,
    max: options.max ?? 10_000,
    min: 1,
  })
}

export function parsePageSize(
  value: unknown,
  options: { default?: number; max?: number } = {}
): number {
  return parsePositiveInt(value, {
    default: options.default ?? 20,
    max: options.max ?? 100,
    min: 1,
  })
}

/**
 * Trim and cap a free-form text query. Returns `undefined` for empty strings
 * so callers can spread the result into `where` clauses without `||` checks.
 */
export function parseSearchKeyword(value: unknown, maxLength = 80): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, maxLength)
}
