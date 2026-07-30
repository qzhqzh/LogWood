interface BoundedIntegerOptions {
  fallback: number
  min: number
  max: number
}

export function boundedWorkerInteger(
  value: string | number | undefined,
  options: BoundedIntegerOptions,
): number {
  if (typeof value === 'string' && value.trim() === '') return options.fallback
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed)) return options.fallback
  return Math.min(Math.max(parsed, options.min), options.max)
}
