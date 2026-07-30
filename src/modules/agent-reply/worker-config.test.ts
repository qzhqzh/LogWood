import { describe, expect, it } from 'vitest'
import { boundedWorkerInteger } from './worker-config'

const OPTIONS = { fallback: 3, min: 1, max: 10 }

describe('agent-reply/worker-config', () => {
  it('uses the fallback for missing, invalid, or fractional values', () => {
    expect(boundedWorkerInteger(undefined, OPTIONS)).toBe(3)
    expect(boundedWorkerInteger('', OPTIONS)).toBe(3)
    expect(boundedWorkerInteger('invalid', OPTIONS)).toBe(3)
    expect(boundedWorkerInteger('2.5', OPTIONS)).toBe(3)
  })

  it('clamps valid integers to the operational range', () => {
    expect(boundedWorkerInteger('0', OPTIONS)).toBe(1)
    expect(boundedWorkerInteger('4', OPTIONS)).toBe(4)
    expect(boundedWorkerInteger(99, OPTIONS)).toBe(10)
  })
})
