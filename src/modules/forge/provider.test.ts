import { describe, expect, it, vi } from 'vitest'
import { generateForgeDraft } from './provider'

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('forge/provider', () => {
  it('returns a structured draft with complete model attribution', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {
      choices: [{ message: { content: JSON.stringify({
        title: '复盘草稿',
        excerpt: '记录失败与验证边界',
        content: '<p>这是一段可继续人工编辑的协作草稿。</p>',
        tags: ['复盘', '复盘'],
      }) } }],
    }))

    const result = await generateForgeDraft({
      kind: 'article',
      prompt: '整理这次实验的输入、失败点和下一步验证。',
    }, {
      apiKey: 'test-key',
      model: 'deepseek-test',
      modelVersion: '2026-08',
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.tags).toEqual(['复盘'])
    expect(result.attribution).toMatchObject({
      provider: 'DeepSeek',
      model: 'deepseek-test',
      modelVersion: '2026-08',
    })
    expect(result.attribution.generatedAt).toBeInstanceOf(Date)
  })

  it('retries a transient provider error once', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(503, { error: 'busy' }))
      .mockResolvedValueOnce(response(200, {
        choices: [{ message: { content: JSON.stringify({
          title: '恢复后的草稿',
          excerpt: '第二次请求成功',
          content: '<p>恢复后返回的完整草稿内容。</p>',
          tags: [],
        }) } }],
      }))

    await expect(generateForgeDraft({ kind: 'article', prompt: '足够长的输入内容。' }, {
      apiKey: 'test-key', fetchImpl,
    })).resolves.toMatchObject({ title: '恢复后的草稿' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects an untrusted provider endpoint before making a request', async () => {
    const fetchImpl = vi.fn()

    await expect(generateForgeDraft({ kind: 'skill', prompt: '足够长的输入内容。' }, {
      apiKey: 'test-key',
      baseUrl: 'https://example.com/v1',
      fetchImpl,
    })).rejects.toMatchObject({ code: 'ERR_FORGE_AI_NOT_CONFIGURED', retryable: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
