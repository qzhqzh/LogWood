import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const isAdminSessionMock = vi.hoisted(() => vi.fn())
const getPromptRunnerModelsMock = vi.hoisted(() => vi.fn())
const runPromptTestMock = vi.hoisted(() => vi.fn())
const scientificCoverMocks = vi.hoisted(() => {
  class ScientificCoverError extends Error {
    constructor(public readonly code: string) {
      super(code)
    }
  }
  return {
    ScientificCoverError,
    getPrompt: vi.fn(),
    persistCandidate: vi.fn(),
  }
})
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/authz', () => ({ isAdminSession: isAdminSessionMock }))
vi.mock('@/lib/logger', () => ({ logger: loggerMock }))
vi.mock('@/modules/prompt-runner', () => ({
  getPromptRunnerModels: getPromptRunnerModelsMock,
  PromptRunnerError: class PromptRunnerError extends Error {},
  runPromptTest: runPromptTestMock,
}))
vi.mock('@/modules/scientific-cover', () => ({
  ScientificCoverError: scientificCoverMocks.ScientificCoverError,
  getScientificCoverPrompt: scientificCoverMocks.getPrompt,
  persistScientificCoverCandidate: scientificCoverMocks.persistCandidate,
}))

import { POST } from './route'

describe('POST /api/prompt-runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'admin-1' } })
    isAdminSessionMock.mockReturnValue(true)
    getPromptRunnerModelsMock.mockReturnValue([
      {
        id: 'deepseek-test',
        label: 'DeepSeek · TEXT / deepseek-test',
        provider: 'DeepSeek',
        outputType: 'text',
        configured: true,
      },
    ])
    scientificCoverMocks.getPrompt.mockResolvedValue({
      prompt: 'server-registered-cover-prompt',
      planned: { candidateId: 'initial-01' },
    })
    scientificCoverMocks.persistCandidate.mockResolvedValue({
      runId: 'cover-20260829-1234abcd',
      status: 'initial-generated',
      generatedCount: 1,
      contactSheetUrl: null,
      candidates: [{ candidateId: 'initial-01', imageUrl: '/api/scientific-covers/candidate' }],
    })
  })

  it('rejects anonymous model use before parsing the prompt', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test', model: 'deepseek-test' }),
    }) as never)

    expect(response.status).toBe(401)
    expect(runPromptTestMock).not.toHaveBeenCalled()
  })

  it('rejects a model outside the configured allowlist', async () => {
    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test', model: 'unlisted-model' }),
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'ERR_PROMPT_RUNNER_MODEL_NOT_ALLOWED' })
    expect(runPromptTestMock).not.toHaveBeenCalled()
  })

  it('returns an explicitly non-persisted test result', async () => {
    runPromptTestMock.mockResolvedValue({
      kind: 'text',
      output: '真实输出',
      requestId: 'request-1',
      attribution: {
        provider: 'DeepSeek',
        model: 'deepseek-test',
        modelVersion: '2026-08',
        generatedAt: new Date('2026-08-23T12:00:00.000Z'),
      },
    })

    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      body: JSON.stringify({ prompt: '执行提示词', model: 'deepseek-test' }),
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      kind: 'text',
      output: '真实输出',
      requestId: 'request-1',
      persisted: false,
    })
    expect(runPromptTestMock).toHaveBeenCalledWith('执行提示词', {
      model: 'deepseek-test',
      signal: expect.any(AbortSignal),
    })
  })

  it('flushes an SSE status event before the model result', async () => {
    runPromptTestMock.mockResolvedValue({
      kind: 'text',
      output: '流式真实输出',
      requestId: 'request-stream-1',
      attribution: {
        provider: 'DeepSeek',
        model: 'deepseek-test',
        modelVersion: '2026-08',
        generatedAt: new Date('2026-08-23T12:00:00.000Z'),
      },
    })

    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: '执行提示词', model: 'deepseek-test' }),
    }) as never)

    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(response.headers.get('x-accel-buffering')).toBe('no')
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    const first = decoder.decode((await reader.read()).value)
    expect(first).toContain('event: status')
    expect(first).not.toContain('event: result')

    let remaining = ''
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      remaining += decoder.decode(chunk.value, { stream: true })
    }
    expect(remaining).toContain('event: result')
    expect(remaining).toContain('流式真实输出')
  })

  it('keeps a slow SSE run alive and cancels its model request when the stream closes', async () => {
    vi.useFakeTimers()
    try {
      runPromptTestMock.mockReturnValue(new Promise(() => {}))

      const response = await POST(new Request('http://localhost/api/prompt-runs', {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: '执行慢提示词', model: 'deepseek-test' }),
      }) as never)
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      expect(decoder.decode((await reader.read()).value)).toContain('event: status')
      const heartbeatRead = reader.read()
      await vi.advanceTimersByTimeAsync(8_000)
      expect(decoder.decode((await heartbeatRead).value)).toBe(': keep-alive\n\n')

      const modelSignal = runPromptTestMock.mock.calls[0][1].signal as AbortSignal
      await reader.cancel()
      expect(modelSignal.aborted).toBe(true)
      expect(loggerMock.info).toHaveBeenCalledWith(
        'prompt_run.cancelled',
        expect.objectContaining({ source: 'stream-cancel' }),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns a CPA image without persisting it', async () => {
    getPromptRunnerModelsMock.mockReturnValue([{
      id: 'cpa:gemini-image',
      label: 'CPA · IMAGE / gemini-image',
      provider: 'CPA',
      outputType: 'image',
      configured: true,
    }])
    runPromptTestMock.mockResolvedValue({
      kind: 'image',
      image: {
        dataUrl: 'data:image/png;base64,aW1hZ2U=',
        mimeType: 'image/png',
        width: 1,
        height: 1,
      },
      requestId: 'cpa-request-1',
      attribution: {
        provider: 'CPA',
        model: 'gemini-image',
        modelVersion: 'gemini-image',
        generatedAt: new Date('2026-08-23T12:00:00.000Z'),
      },
    })

    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      body: JSON.stringify({ prompt: '生成图像', model: 'cpa:gemini-image' }),
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      kind: 'image',
      image: { mimeType: 'image/png', width: 1, height: 1 },
      persisted: false,
    })
  })

  it('replaces client text with the registered cover prompt and persists the generated candidate', async () => {
    getPromptRunnerModelsMock.mockReturnValue([{
      id: 'cpa:gemini-image',
      label: 'CPA · IMAGE / gemini-image',
      provider: 'CPA',
      outputType: 'image',
      configured: true,
    }])
    const imageResult = {
      kind: 'image' as const,
      image: {
        dataUrl: 'data:image/png;base64,aW1hZ2U=',
        mimeType: 'image/png' as const,
        width: 1,
        height: 1,
      },
      requestId: 'cover-request-1',
      attribution: {
        provider: 'CPA',
        model: 'gemini-image',
        modelVersion: 'gemini-image',
        generatedAt: new Date('2026-08-23T12:00:00.000Z'),
      },
    }
    runPromptTestMock.mockResolvedValue(imageResult)

    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'client-tampered-prompt',
        model: 'cpa:gemini-image',
        scientificCover: {
          runId: 'cover-20260829-1234abcd',
          candidateId: 'initial-01',
        },
      }),
    }) as never)

    expect(response.status).toBe(200)
    expect(runPromptTestMock).toHaveBeenCalledWith('server-registered-cover-prompt', {
      model: 'cpa:gemini-image',
      signal: expect.any(AbortSignal),
    })
    expect(scientificCoverMocks.persistCandidate).toHaveBeenCalledWith(
      'admin-1',
      'cover-20260829-1234abcd',
      'initial-01',
      imageResult,
    )
    expect(await response.json()).toMatchObject({
      kind: 'image',
      persisted: true,
      scientificCover: {
        runId: 'cover-20260829-1234abcd',
        candidateId: 'initial-01',
        generatedCount: 1,
      },
    })
  })

  it('blocks a text model before resolving a scientific cover prompt', async () => {
    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      body: JSON.stringify({
        model: 'deepseek-test',
        scientificCover: {
          runId: 'cover-20260829-1234abcd',
          candidateId: 'initial-01',
        },
      }),
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'ERR_SCIENTIFIC_COVER_IMAGE_MODEL_REQUIRED' })
    expect(scientificCoverMocks.getPrompt).not.toHaveBeenCalled()
    expect(runPromptTestMock).not.toHaveBeenCalled()
  })

  it('maps a blocked journal policy before invoking the image model', async () => {
    getPromptRunnerModelsMock.mockReturnValue([{
      id: 'cpa:gemini-image',
      label: 'CPA · IMAGE / gemini-image',
      provider: 'CPA',
      outputType: 'image',
      configured: true,
    }])
    scientificCoverMocks.getPrompt.mockRejectedValue(
      new scientificCoverMocks.ScientificCoverError('ERR_SCIENTIFIC_COVER_BLOCKED'),
    )

    const response = await POST(new Request('http://localhost/api/prompt-runs', {
      method: 'POST',
      body: JSON.stringify({
        model: 'cpa:gemini-image',
        scientificCover: {
          runId: 'cover-20260829-1234abcd',
          candidateId: 'initial-01',
        },
      }),
    }) as never)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'ERR_SCIENTIFIC_COVER_BLOCKED',
      retryable: false,
    })
    expect(runPromptTestMock).not.toHaveBeenCalled()
  })
})
