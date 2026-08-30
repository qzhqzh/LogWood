import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/authz'
import { logger } from '@/lib/logger'
import {
  getPromptRunnerModels,
  PromptRunnerError,
  runPromptTest,
} from '@/modules/prompt-runner'
import type { PromptRunnerModel, PromptTestResult } from '@/modules/prompt-runner'
import {
  getScientificCoverPrompt,
  persistScientificCoverCandidate,
  ScientificCoverError,
} from '@/modules/scientific-cover'

export const dynamic = 'force-dynamic'

const promptRunSchema = z.object({
  prompt: z.string().trim().min(1).max(12_000).optional(),
  model: z.string().trim().min(1).max(80),
  scientificCover: z.object({
    runId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    candidateId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  }).strict().optional(),
}).superRefine((input, context) => {
  if (!input.prompt && !input.scientificCover) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prompt'],
      message: 'A prompt is required outside a scientific cover run',
    })
  }
})

type PromptRunInput = z.infer<typeof promptRunSchema> & { prompt: string }
type ScientificCoverRequest = NonNullable<z.infer<typeof promptRunSchema>['scientificCover']>

const SSE_HEARTBEAT_MS = 8_000

function baseSerializedResult(result: PromptTestResult) {
  return {
    kind: result.kind,
    ...(result.kind === 'image'
      ? { image: result.image }
      : { output: result.output }),
    requestId: result.requestId,
    attribution: {
      ...result.attribution,
      generatedAt: result.attribution.generatedAt.toISOString(),
    },
    persisted: false,
  }
}

function persistenceErrorCode(error: unknown) {
  return error instanceof ScientificCoverError
    ? error.code
    : 'ERR_SCIENTIFIC_COVER_PERSISTENCE'
}

async function serializedResult(
  result: PromptTestResult,
  ownerUserId?: string,
  scientificCover?: ScientificCoverRequest,
) {
  const serialized = baseSerializedResult(result)
  if (!ownerUserId || !scientificCover) return serialized

  try {
    const run = await persistScientificCoverCandidate(
      ownerUserId,
      scientificCover.runId,
      scientificCover.candidateId,
      result,
    )
    const candidate = run.candidates.find((entry) => entry.candidateId === scientificCover.candidateId)
    return {
      ...serialized,
      persisted: true,
      scientificCover: {
        runId: run.runId,
        candidateId: scientificCover.candidateId,
        imageUrl: candidate?.imageUrl ?? null,
        status: run.status,
        generatedCount: run.generatedCount,
        contactSheetUrl: run.contactSheetUrl,
      },
    }
  } catch (error) {
    const code = persistenceErrorCode(error)
    logger.error('prompt_run.scientific_cover_persist_failed', {
      runId: scientificCover.runId,
      candidateId: scientificCover.candidateId,
      code,
    })
    return { ...serialized, persistenceError: code }
  }
}

function runnerFailure(error: unknown) {
  if (error instanceof PromptRunnerError) {
    return { error: error.code, retryable: error.retryable }
  }
  return { error: 'ERR_PROMPT_RUNNER_UNAVAILABLE', retryable: true }
}

function runnerFailureStatus(error: PromptRunnerError) {
  if (error.code === 'ERR_PROMPT_RUNNER_CANCELLED') return 499
  if (error.code === 'ERR_PROMPT_RUNNER_AUTH') return 502
  if (error.code === 'ERR_PROMPT_RUNNER_NOT_CONFIGURED') return 503
  if (error.code === 'ERR_PROMPT_RUNNER_INVALID_RESPONSE') return 502
  return 503
}

function scientificCoverFailureStatus(error: ScientificCoverError) {
  if (error.code === 'ERR_SCIENTIFIC_COVER_NOT_FOUND') return 404
  if (error.code === 'ERR_SCIENTIFIC_COVER_BLOCKED') return 403
  if (
    error.code === 'ERR_SCIENTIFIC_COVER_POLICY_EXPIRED'
    || error.code === 'ERR_SCIENTIFIC_COVER_CANDIDATE_EXISTS'
    || error.code === 'ERR_SCIENTIFIC_COVER_PROMPT_INTEGRITY'
  ) return 409
  return 400
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function streamPromptRun(
  request: NextRequest,
  input: PromptRunInput,
  selectedModel: PromptRunnerModel,
  ownerUserId: string,
) {
  const encoder = new TextEncoder()
  const runId = crypto.randomUUID()
  const startedAt = Date.now()
  const modelController = new AbortController()
  let finished = false
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let requestAbortHandler: (() => void) | undefined

  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat)
    if (requestAbortHandler) {
      request.signal.removeEventListener('abort', requestAbortHandler)
      requestAbortHandler = undefined
    }
  }
  const cancelRun = (source: string) => {
    if (finished) return
    finished = true
    cleanup()
    modelController.abort()
    logger.info('prompt_run.cancelled', {
      runId,
      source,
      provider: selectedModel.provider,
      model: selectedModel.id,
      durationMs: Date.now() - startedAt,
    })
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      requestAbortHandler = () => cancelRun('request-signal')
      request.signal.addEventListener('abort', requestAbortHandler, { once: true })
      if (request.signal.aborted) {
        cancelRun('request-signal')
        controller.close()
        return
      }
      logger.info('prompt_run.started', {
        runId,
        transport: 'sse',
        provider: selectedModel.provider,
        model: selectedModel.id,
        outputType: selectedModel.outputType,
        promptChars: input.prompt.length,
      })
      controller.enqueue(encoder.encode(sseEvent('status', { status: 'running' })))
      heartbeat = setInterval(() => {
        if (finished) return
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
        } catch {
          cancelRun('stream-enqueue')
        }
      }, SSE_HEARTBEAT_MS)

      void runPromptTest(input.prompt, {
        model: selectedModel.id,
        signal: modelController.signal,
      }).then(async (result) => {
        if (finished) return
        const responseBody = await serializedResult(result, ownerUserId, input.scientificCover)
        if (finished) return
        finished = true
        cleanup()
        logger.info('prompt_run.completed', {
          runId,
          transport: 'sse',
          provider: result.attribution.provider,
          model: result.attribution.model,
          outputType: result.kind,
          durationMs: Date.now() - startedAt,
        })
        controller.enqueue(encoder.encode(sseEvent('result', responseBody)))
        controller.close()
      }).catch((error: unknown) => {
        if (finished) return
        finished = true
        cleanup()
        const failure = runnerFailure(error)
        logger.warn('prompt_run.failed', {
          runId,
          transport: 'sse',
          provider: selectedModel.provider,
          model: selectedModel.id,
          code: failure.error,
          retryable: failure.retryable,
          durationMs: Date.now() - startedAt,
        })
        controller.enqueue(encoder.encode(sseEvent('error', failure)))
        controller.close()
      })
    },
    cancel() {
      cancelRun('stream-cancel')
    },
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-store, no-cache, no-transform',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
  }
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'ERR_FORBIDDEN' }, { status: 403 })
  }

  try {
    const parsedInput = promptRunSchema.parse(await request.json())
    const selectedModel = getPromptRunnerModels().find((model) => model.id === parsedInput.model)
    if (!selectedModel) {
      return NextResponse.json({ error: 'ERR_PROMPT_RUNNER_MODEL_NOT_ALLOWED' }, { status: 400 })
    }
    if (!selectedModel.configured) {
      return NextResponse.json(
        { error: 'ERR_PROMPT_RUNNER_NOT_CONFIGURED', retryable: false },
        { status: 503 },
      )
    }
    if (parsedInput.scientificCover && selectedModel.outputType !== 'image') {
      return NextResponse.json(
        { error: 'ERR_SCIENTIFIC_COVER_IMAGE_MODEL_REQUIRED' },
        { status: 400 },
      )
    }

    const resolvedPrompt = parsedInput.scientificCover
      ? (await getScientificCoverPrompt(
          session.user.id,
          parsedInput.scientificCover.runId,
          parsedInput.scientificCover.candidateId,
        )).prompt
      : parsedInput.prompt!
    const input: PromptRunInput = { ...parsedInput, prompt: resolvedPrompt }

    if (request.headers.get('accept')?.includes('text/event-stream')) {
      return streamPromptRun(request, input, selectedModel, session.user.id)
    }

    const runId = crypto.randomUUID()
    const startedAt = Date.now()
    logger.info('prompt_run.started', {
      runId,
      transport: 'json',
      provider: selectedModel.provider,
      model: selectedModel.id,
      outputType: selectedModel.outputType,
      promptChars: input.prompt.length,
    })
    try {
      const result = await runPromptTest(input.prompt, {
        model: selectedModel.id,
        signal: request.signal,
      })
      logger.info('prompt_run.completed', {
        runId,
        transport: 'json',
        provider: result.attribution.provider,
        model: result.attribution.model,
        outputType: result.kind,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json(
        await serializedResult(result, session.user.id, input.scientificCover),
        {
        headers: { 'Cache-Control': 'no-store' },
        },
      )
    } catch (error) {
      const failure = runnerFailure(error)
      logger.warn('prompt_run.failed', {
        runId,
        transport: 'json',
        provider: selectedModel.provider,
        model: selectedModel.id,
        code: failure.error,
        retryable: failure.retryable,
        durationMs: Date.now() - startedAt,
      })
      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_PROMPT_RUNNER_VALIDATION', details: error.errors },
        { status: 400 },
      )
    }
    if (error instanceof PromptRunnerError) {
      return NextResponse.json(
        { error: error.code, retryable: error.retryable },
        { status: runnerFailureStatus(error) },
      )
    }
    if (error instanceof ScientificCoverError) {
      return NextResponse.json(
        { error: error.code, retryable: false },
        { status: scientificCoverFailureStatus(error) },
      )
    }

    logger.error('prompt_run.route_failed', {
      errorName: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: 'ERR_PROMPT_RUNNER_UNAVAILABLE', retryable: true },
      { status: 503 },
    )
  }
}
