import { describe, expect, it, vi } from 'vitest'
import {
  buildCandidateIdeaKey,
  CandidateIdeaError,
  extractInputUrls,
  generateCandidateIdea,
} from './idea'

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('candidate/idea', () => {
  it('builds a stable key from source URL or normalized raw input', () => {
    expect(buildCandidateIdeaKey({
      title: 'Any title',
      sourceUrl: 'github.com/example/repo',
      rawInput: 'ignored',
    })).toBe(buildCandidateIdeaKey({
      title: 'Different model title',
      sourceUrl: 'https://github.com/example/repo',
      rawInput: 'also ignored',
    }))

    expect(buildCandidateIdeaKey({
      title: 'Any title',
      rawInput: '  热门 名称  ',
    })).toBe(buildCandidateIdeaKey({
      title: 'Different model title',
      rawInput: '热门 名称',
    }))
  })

  it('extracts and normalizes supported input URLs', () => {
    expect(extractInputUrls('看看 github.com/example/repo，还有 https://docs.example.com/a。')).toEqual([
      'https://github.com/example/repo',
      'https://docs.example.com/a',
    ])
  })

  it('parses a structured idea and keeps only URLs from the user input', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      choices: [{
        message: {
          content: JSON.stringify({
          title: 'Example Repo',
          summary: '一个可能值得观察的开发工具仓库，需要进一步确认核心能力和维护状态。',
          sourceUrl: 'https://github.com/example/repo',
          websiteUrl: 'https://invented.example.com',
          tags: ['GitHub', '开发工具', 'GitHub'],
        }),
        },
      }],
    }))

    const idea = await generateCandidateIdea(
      '看看 https://github.com/example/repo 是否值得试用',
      { apiKey: 'test-key', fetchImpl },
    )

    expect(idea).toEqual({
      title: 'Example Repo',
      summary: '一个可能值得观察的开发工具仓库，需要进一步确认核心能力和维护状态。',
      sourceUrl: 'https://github.com/example/repo',
      tags: ['GitHub', '开发工具'],
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('normalizes a protocol-less URL returned by the model', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      choices: [{
        message: {
          content: JSON.stringify({
          title: 'Example Repo',
          summary: '一个可能值得观察的仓库，需要进一步确认核心能力和维护状态。',
          sourceUrl: 'github.com/example/repo',
          websiteUrl: null,
          tags: ['GitHub'],
        }),
        },
      }],
    }))

    await expect(generateCandidateIdea('github.com/example/repo', {
      apiKey: 'test-key',
      fetchImpl,
    })).resolves.toMatchObject({
      sourceUrl: 'https://github.com/example/repo',
    })
  })

  it('rejects model output with a blank title after trimming', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      choices: [{
        message: {
          content: JSON.stringify({
          title: '   ',
          summary: '一个可能值得观察的工具，需要进一步确认核心能力和维护状态。',
          sourceUrl: null,
          websiteUrl: null,
          tags: ['待验证'],
        }),
        },
      }],
    }))

    await expect(generateCandidateIdea('一个工具', {
      apiKey: 'test-key',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_IDEA_AI_INVALID_RESPONSE',
    })
  })

  it('rejects malformed model output without creating a fallback idea', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      choices: [{ message: { content: 'not-json' } }],
    }))

    await expect(generateCandidateIdea('一个想法', {
      apiKey: 'test-key',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_IDEA_AI_INVALID_RESPONSE',
    })
  })

  it('requires a server-side API key', async () => {
    await expect(generateCandidateIdea('一个想法', {
      apiKey: '',
    })).rejects.toBeInstanceOf(CandidateIdeaError)
  })

  it('refuses to send the API key to a non-DeepSeek endpoint', async () => {
    const fetchImpl = vi.fn()

    await expect(generateCandidateIdea('一个想法', {
      apiKey: 'test-key',
      baseUrl: 'https://example.com/apps/anthropic',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_IDEA_AI_NOT_CONFIGURED',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('retries transient provider failures once', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ error: 'busy' }, 503))
      .mockResolvedValueOnce(response({
        choices: [{
          message: {
            content: JSON.stringify({
            title: '待观察工具',
            summary: '这可能是一个值得观察的工具名称，下一步需要确认官方来源和实际用途。',
            sourceUrl: null,
            websiteUrl: null,
            tags: ['待验证'],
          }),
          },
        }],
      }))

    await expect(generateCandidateIdea('待观察工具', {
      apiKey: 'test-key',
      fetchImpl,
    })).resolves.toMatchObject({ title: '待观察工具' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('reports rejected provider credentials without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      type: 'authentication_error',
    }, 403))

    await expect(generateCandidateIdea('一个想法', {
      apiKey: 'test-key',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_IDEA_AI_AUTH',
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
})
