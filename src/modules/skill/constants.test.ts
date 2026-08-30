import { describe, expect, it } from 'vitest'
import {
  isRunnablePromptOutput,
  promptOutputKind,
  withPromptOutputKind,
  withoutPromptOutputTag,
} from './constants'

describe('prompt output compatibility', () => {
  it('keeps legacy image categories runnable without rewriting stored data', () => {
    expect(promptOutputKind({ category: 'image', tags: ['海报'] })).toBe('image')
    expect(isRunnablePromptOutput('image')).toBe(true)
  })

  it('lets a reserved tag distinguish managed-only output kinds from categories', () => {
    expect(promptOutputKind({
      category: 'workflow',
      tags: ['工作流', 'output:document'],
    })).toBe('document')
    expect(isRunnablePromptOutput('document')).toBe(false)
  })

  it('replaces only the reserved output tag and preserves user tags', () => {
    expect(withPromptOutputKind(
      ['图像', 'output:text', '客户交付'],
      'video',
    )).toEqual(['图像', '客户交付', 'output:video'])
    expect(withoutPromptOutputTag(['图像', 'output:video'])).toEqual(['图像'])
  })
})
