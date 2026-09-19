import { describe, expect, it } from 'vitest'
import {
  confirmArticlePublicationSchema,
  publishReviewSchema,
  recordInspirationSchema,
  replyTaskPlanSchema,
  replyTaskRenewSchema,
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

  it('accepts explicit private visibility for topic archives', () => {
    expect(recordInspirationSchema.parse({
      content: '归档一个待打磨的文章选题',
      visibility: 'private',
    })).toMatchObject({ visibility: 'private' })

    expect(updateInspirationSchema.parse({
      candidateId: 'candidate-1',
      visibility: 'private',
    })).toMatchObject({ visibility: 'private' })
  })

  it('requires an actual inspiration update', () => {
    expect(() => updateInspirationSchema.parse({
      candidateId: 'candidate-1',
    })).toThrow()

    expect(() => updateInspirationSchema.parse({
      candidateId: 'candidate-1',
      status: 'promoted',
    })).toThrow()
  })

  it('requires a lease token before planning an agent reply', () => {
    expect(() => replyTaskPlanSchema.parse({
      taskId: 'task-1',
      selectedAgentIds: ['agent-1'],
    })).toThrow()

    expect(replyTaskPlanSchema.parse({
      taskId: 'task-1',
      leaseToken: 'lease-token-123456',
      selectedAgentIds: ['agent-1'],
    })).toMatchObject({
      taskId: 'task-1',
      leaseToken: 'lease-token-123456',
    })

    expect(() => replyTaskRenewSchema.parse({
      taskId: 'task-1',
      leaseSeconds: 600,
    })).toThrow()
  })

  it('rejects non-http links and protocol-relative asset URLs', () => {
    expect(() => recordInspirationSchema.parse({
      content: '记录危险链接',
      sourceUrl: 'javascript:alert(1)',
    })).toThrow()
    expect(() => recordInspirationSchema.parse({
      content: '记录站外图片',
      previewImageUrl: '//evil.example/image.png',
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

  it('requires an exact article version and explicit publication confirmation', () => {
    expect(() => confirmArticlePublicationSchema.parse({
      articleId: 'article-1',
      expectedVersion: 2,
      confirmation: 'yes',
    })).toThrow()

    expect(confirmArticlePublicationSchema.parse({
      articleId: 'article-1',
      expectedVersion: 2,
      confirmation: 'CONFIRM_PUBLISH_CURRENT_VERSION',
    })).toEqual({
      articleId: 'article-1',
      expectedVersion: 2,
      confirmation: 'CONFIRM_PUBLISH_CURRENT_VERSION',
    })
  })
})
