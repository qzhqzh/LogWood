import { describe, expect, it, vi } from 'vitest'
import { generateCpaImage, parseCpaApiKey } from './cpa-image'

const ONE_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function response(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('prompt-runner/cpa-image', () => {
  it('reads only the first top-level CPA client key', () => {
    expect(parseCpaApiKey(`host: ""
api-keys:
  - 'first-client-key'
  - second-client-key
remote-management:
  secret-key: management-key
`)).toBe('first-client-key')
  })

  it('generates a bounded image through the OpenAI-compatible chat endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {
      id: 'cpa-request-1',
      model: 'gemini-image-resolved',
      choices: [{
        message: {
          images: [{ image_url: { url: `data:image/png;base64,${ONE_PIXEL_PNG}` } }],
        },
      }],
    }))

    const result = await generateCpaImage('生成一张绿色方块', {
      apiKey: 'test-client-key',
      baseUrl: 'http://192.168.124.2:31000/v1',
      allowedHttpHosts: '192.168.124.2',
      model: 'gemini-image',
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://192.168.124.2:31000/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    )
    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))
    expect(request.messages[0].content).toEqual([{ type: 'text', text: '生成一张绿色方块' }])
    expect(result).toMatchObject({
      mimeType: 'image/png',
      width: 1,
      height: 1,
      model: 'gemini-image-resolved',
      requestId: 'cpa-request-1',
    })
    expect(result.dataUrl).toBe(`data:image/png;base64,${ONE_PIXEL_PNG}`)
  })

  it('rejects an HTTP host unless it is loopback or explicitly allowed', async () => {
    const fetchImpl = vi.fn()

    await expect(generateCpaImage('不会发送', {
      apiKey: 'test-client-key',
      baseUrl: 'http://192.168.124.2:31000/v1',
      model: 'gemini-image',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_PROMPT_RUNNER_NOT_CONFIGURED',
      retryable: false,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects image bytes that do not match the declared MIME type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {
      choices: [{
        message: {
          images: [{ image_url: `data:image/png;base64,${Buffer.from('not an image').toString('base64')}` }],
        },
      }],
    }))

    await expect(generateCpaImage('invalid image', {
      apiKey: 'test-client-key',
      model: 'gemini-image',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_PROMPT_RUNNER_INVALID_RESPONSE',
      retryable: false,
    })
  })

  it('rejects a response whose declared size exceeds the server limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {}, {
      'content-length': String(24 * 1024 * 1024 + 1),
    }))

    await expect(generateCpaImage('oversized response', {
      apiKey: 'test-client-key',
      model: 'gemini-image',
      fetchImpl,
    })).rejects.toMatchObject({
      code: 'ERR_PROMPT_RUNNER_INVALID_RESPONSE',
      retryable: false,
    })
  })

  it('cancels the in-flight CPA request when the caller disconnects', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))

    const pending = generateCpaImage('会被取消的生图提示词', {
      apiKey: 'test-client-key',
      model: 'gemini-image',
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
