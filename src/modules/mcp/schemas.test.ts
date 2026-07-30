import { describe, expect, it } from 'vitest'
import {
  publishReviewSchema,
  recordInspirationSchema,
  updateInspirationSchema,
} from './schemas'

describe('mcp/schemas', () => {
  it('accepts a minimal immediate inspiration record', () => {
    expect(recordInspirationSchema.parse({
      content: '研究一个更适合移动端的图片归档流程',
    })).toEqual({
      content: '研究一个更适合移动端的图片归档流程',
    })
  })

  it('requires an actual inspiration update', () => {
    expect(() => updateInspirationSchema.parse({
      candidateId: 'candidate-1',
    })).toThrow()
  })

  it('requires exactly one review subject reference and complete AI metadata', () => {
    expect(() => publishReviewSchema.parse({
      subjectType: 'skill',
      subjectId: 'skill-1',
      subjectSlug: 'release-workflow',
      rating: 4,
      content: '流程清晰，但缺少失败回滚示例。',
      aiAttribution: {
        provider: 'OpenAI',
        model: 'gpt-5.4',
      },
    })).toThrow()

    expect(publishReviewSchema.parse({
      subjectType: 'skill',
      subjectSlug: 'release-workflow',
      rating: 4,
      content: '流程清晰，但缺少失败回滚示例。',
      aiAttribution: {
        provider: 'OpenAI',
        model: 'gpt-5.4',
        modelVersion: '2026-06-01',
        generatedAt: '2026-07-29T12:00:00Z',
      },
    }).aiAttribution.generatedAt).toEqual(new Date('2026-07-29T12:00:00Z'))
  })
})
