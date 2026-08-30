import { describe, expect, it, vi } from 'vitest'
import { getPromptRunnerModels, runPromptTest } from './provider'

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('prompt-runner/provider', () => {
  it('exposes only unique, valid configured model ids', () => {
    expect(getPromptRunnerModels({
      DEEPSEEK_WORKBENCH_MODELS: 'deepseek-a, invalid model, deepseek-b, deepseek-a',
      DEEPSEEK_API_KEY: 'deepseek-key',
      CPA_API_KEY: 'cpa-key',
      CPA_IMAGE_MODELS: 'gemini-image, invalid model, gemini-image',
    })).toEqual([
      {
        id: 'deepseek-a',
        label: 'DeepSeek · TEXT / deepseek-a',
        provider: 'DeepSeek',
        outputType: 'text',
        configured: true,
      },
      {
        id: 'deepseek-b',
        label: 'DeepSeek · TEXT / deepseek-b',
        provider: 'DeepSeek',
        outputType: 'text',
        configured: true,
      },
      {
        id: 'cpa:gemini-image',
        label: 'CPA · IMAGE / gemini-image',
        provider: 'CPA',
        outputType: 'image',
        configured: true,
      },
    ])
  })

  it('returns plain output with explicit attribution and the provider request id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {
      id: 'request-1',
      model: 'deepseek-test',
      choices: [{ message: { content: '  实际测试输出  ' } }],
    }))

    const result = await runPromptTest('执行这一条提示词', {
      apiKey: 'test-key',
      model: 'deepseek-test',
      modelVersion: '2026-08',
      fetchImpl,
    })

    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: '执行这一条提示词' })
    expect(result).toMatchObject({
      kind: 'text',
      output: '实际测试输出',
      requestId: 'request-1',
      attribution: {
        provider: 'DeepSeek',
        model: 'deepseek-test',
        modelVersion: '2026-08',
      },
    })
    expect(result.attribution.generatedAt).toBeInstanceOf(Date)
  })

  it('falls back to the actual model when a configured version is blank', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {
      model: 'deepseek-resolved',
      choices: [{ message: { content: '可审计输出' } }],
    }))

    const result = await runPromptTest('检查空版本回退', {
      apiKey: 'test-key',
      model: 'deepseek-requested',
      modelVersion: '   ',
      fetchImpl,
    })

    expect(result.attribution).toMatchObject({
      model: 'deepseek-resolved',
      modelVersion: 'deepseek-resolved',
    })
  })

  it('rejects an untrusted endpoint without sending the prompt', async () => {
    const fetchImpl = vi.fn()

    await expect(runPromptTest('不会发送的提示词', {
      apiKey: 'test-key',
      baseUrl: 'https://example.com/v1',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_PROMPT_RUNNER_NOT_CONFIGURED',
      retryable: false,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not retry after the caller cancels a model request', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))

    const pending = runPromptTest('会被取消的提示词', {
      apiKey: 'test-key',
      model: 'deepseek-test',
      fetchImpl,
      signal: controller.signal,
    })
    controller.abort()

    await expect(pending).rejects.toMatchObject({
      code: 'ERR_PROMPT_RUNNER_CANCELLED',
      retryable: false,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
