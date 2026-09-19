import { describe, expect, it, vi } from 'vitest'
import { generateThoughtReply } from './provider'

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('thought/provider', () => {
  it('continues a discussion and records complete attribution', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {
      choices: [{ message: { content: '这里真正值得追问的是：效率提升之后，你想把省下来的注意力留给什么？' } }],
    }))

    const result = await generateThoughtReply([{
      id: 'turn-0001',
      role: 'user',
      content: '我越来越觉得，工具的价值不是让我做得更多，而是让我少做重复劳动。',
      createdAt: '2026-08-30T08:00:00.000Z',
    }], {
      apiKey: 'test-key',
      model: 'deepseek-test',
      modelVersion: '2026-08',
      fetchImpl,
    })

    expect(result.content).toContain('注意力')
    expect(result.attribution).toMatchObject({
      provider: 'DeepSeek',
      model: 'deepseek-test',
      modelVersion: '2026-08',
    })
    const request = fetchImpl.mock.calls[0][1]
    const body = JSON.parse(String(request.body))
    expect(body.messages.at(-1)).toEqual(expect.objectContaining({
      role: 'user',
    }))
  })

  it('does not send a request to an untrusted endpoint', async () => {
    const fetchImpl = vi.fn()
    await expect(generateThoughtReply([], {
      apiKey: 'test-key',
      baseUrl: 'https://example.com/v1',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_THOUGHT_AI_NOT_CONFIGURED',
      retryable: false,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
