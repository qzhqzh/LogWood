import { describe, expect, it } from 'vitest'
import { assessContent } from './service'

describe('like/assessContent', () => {
  it('flags sensitive words', () => {
    const result = assessContent('这工具太垃圾了，体验很差')

    expect(result.flagged).toBe(true)
    expect(result.reason).toBe('sensitive_word')
  })

  it('flags repetitive spam content', () => {
    const result = assessContent(`${'a'.repeat(211)}${'b'.repeat(12)}`)

    expect(result.flagged).toBe(true)
    expect(result.reason).toBe('repetitive')
  })

  it('accepts normal content', () => {
    const result = assessContent('这个工具在代码补全上有提升，但在复杂重构时仍有误判。')

    expect(result.flagged).toBe(false)
    expect(result.reason).toBeUndefined()
  })
})
