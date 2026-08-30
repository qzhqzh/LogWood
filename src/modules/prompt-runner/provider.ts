import * as z from 'zod'
import { generateCpaImage, isCpaImageConfigured } from './cpa-image'
import { PromptRunnerError } from './error'

export { PromptRunnerError } from './error'

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL = 'deepseek-v4-pro'
const DEFAULT_CPA_IMAGE_MODEL = 'gemini-3.1-flash-image'
const REQUEST_TIMEOUT_MS = 45_000
const MAX_ATTEMPTS = 2
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i

const responseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
})

export interface PromptRunnerEnvironment {
  [key: string]: string | undefined
  DEEPSEEK_API_KEY?: string
  DEEPSEEK_BASE_URL?: string
  DEEPSEEK_FORGE_MODEL?: string
  DEEPSEEK_FORGE_MODEL_VERSION?: string
  DEEPSEEK_WORKBENCH_MODELS?: string
  DEEPSEEK_WORKBENCH_MODEL_VERSION?: string
  CPA_API_KEY?: string
  CPA_CONFIG_FILE?: string
  CPA_BASE_URL?: string
  CPA_HTTP_ALLOWED_HOSTS?: string
  CPA_IMAGE_MODELS?: string
  CPA_IMAGE_MODEL_VERSION?: string
}

export type PromptOutputType = 'text' | 'image'

export interface PromptRunnerModel {
  id: string
  label: string
  provider: 'DeepSeek' | 'CPA'
  outputType: PromptOutputType
  configured: boolean
}

interface PromptTestResultBase {
  requestId?: string
  attribution: {
    provider: 'DeepSeek' | 'CPA'
    model: string
    modelVersion: string
    generatedAt: Date
  }
}

export interface PromptTextResult extends PromptTestResultBase {
  kind: 'text'
  output: string
}

export interface PromptImageResult extends PromptTestResultBase {
  kind: 'image'
  image: {
    dataUrl: string
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
    width: number
    height: number
  }
}

export type PromptTestResult = PromptTextResult | PromptImageResult

interface RunPromptTestOptions {
  apiKey?: string
  baseUrl?: string
  allowedHttpHosts?: string
  model?: string
  modelVersion?: string
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export function getPromptRunnerModels(
  env: PromptRunnerEnvironment = process.env,
): PromptRunnerModel[] {
  const deepSeekIds = modelIds(env.DEEPSEEK_WORKBENCH_MODELS?.trim()
    || env.DEEPSEEK_FORGE_MODEL?.trim()
    || DEFAULT_MODEL, DEFAULT_MODEL)
  const cpaIds = modelIds(env.CPA_IMAGE_MODELS?.trim() || DEFAULT_CPA_IMAGE_MODEL, DEFAULT_CPA_IMAGE_MODEL)
  const deepSeekConfigured = Boolean(env.DEEPSEEK_API_KEY?.trim())
  const cpaConfigured = isCpaImageConfigured(env)

  return [
    ...deepSeekIds.map((id) => ({
      id,
      label: `DeepSeek · TEXT / ${id}`,
      provider: 'DeepSeek' as const,
      outputType: 'text' as const,
      configured: deepSeekConfigured,
    })),
    ...cpaIds.map((id) => ({
      id: `cpa:${id}`,
      label: `CPA · IMAGE / ${id}`,
      provider: 'CPA' as const,
      outputType: 'image' as const,
      configured: cpaConfigured,
    })),
  ]
}

export function isPromptRunnerConfigured(
  env: PromptRunnerEnvironment = process.env,
  outputType?: PromptOutputType,
) {
  return getPromptRunnerModels(env).some((model) => (
    model.configured && (!outputType || model.outputType === outputType)
  ))
}

function modelIds(configured: string, fallback: string) {
  const ids = Array.from(new Set(
    configured
      .split(',')
      .map((value) => value.trim())
      .filter((value) => MODEL_ID_PATTERN.test(value)),
  )).slice(0, 6)
  return ids.length > 0 ? ids : [fallback]
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? ''
}

function endpoint(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl.trim())
    const path = parsed.pathname.replace(/\/+$/, '')
    if (
      parsed.protocol !== 'https:'
      || parsed.hostname !== 'api.deepseek.com'
      || parsed.username
      || parsed.password
      || (parsed.port && parsed.port !== '443')
      || (path !== '' && path !== '/v1')
    ) {
      throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)
    }
    parsed.pathname = '/v1/chat/completions'
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch (error) {
    if (error instanceof PromptRunnerError) throw error
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)
  }
}

function shouldRetry(status: number) {
  return status === 408 || status === 429 || status >= 500
}

const SYSTEM_PROMPT = `You are the execution model inside a read-only prompt testing workbench.
Execute the user's prompt directly and return only the requested result.
You have no tools, browsing, filesystem, or publishing access. If the prompt requires one of those capabilities, state that limitation instead of claiming the action happened.`

export async function runPromptTest(
  prompt: string,
  options: RunPromptTestOptions = {},
): Promise<PromptTestResult> {
  const requestedModel = options.model ?? process.env.DEEPSEEK_FORGE_MODEL ?? DEFAULT_MODEL
  if (requestedModel.startsWith('cpa:')) {
    const model = requestedModel.slice('cpa:'.length)
    if (!MODEL_ID_PATTERN.test(model)) {
      throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)
    }
    const result = await generateCpaImage(prompt, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      allowedHttpHosts: options.allowedHttpHosts,
      model,
      fetchImpl: options.fetchImpl,
      signal: options.signal,
    })
    return {
      kind: 'image',
      image: {
        dataUrl: result.dataUrl,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
      },
      requestId: result.requestId,
      attribution: {
        provider: 'CPA',
        model: result.model,
        modelVersion: firstNonEmpty(
          options.modelVersion,
          process.env.CPA_IMAGE_MODEL_VERSION,
          result.model,
        ),
        generatedAt: new Date(),
      },
    }
  }

  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)
  const model = requestedModel
  if (!MODEL_ID_PATTERN.test(model)) {
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const url = endpoint(options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const abortFromCaller = () => controller.abort(options.signal?.reason)
    if (options.signal?.aborted) abortFromCaller()
    else options.signal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 2_000,
          temperature: 0.35,
          stream: false,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt.trim() },
          ],
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new PromptRunnerError('ERR_PROMPT_RUNNER_AUTH', false)
        }
        if (attempt + 1 < MAX_ATTEMPTS && shouldRetry(response.status)) continue
        throw new PromptRunnerError('ERR_PROMPT_RUNNER_UNAVAILABLE', shouldRetry(response.status))
      }

      const envelope = responseSchema.safeParse(await response.json().catch(() => null))
      const output = envelope.success ? envelope.data.choices[0].message.content?.trim() : null
      if (!output) throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', true)
      const resolvedModel = envelope.success ? envelope.data.model || model : model

      return {
        kind: 'text',
        output,
        requestId: envelope.success ? envelope.data.id : undefined,
        attribution: {
          provider: 'DeepSeek',
          model: resolvedModel,
          modelVersion: firstNonEmpty(
            options.modelVersion,
            process.env.DEEPSEEK_WORKBENCH_MODEL_VERSION,
            process.env.DEEPSEEK_FORGE_MODEL_VERSION,
            resolvedModel,
          ),
          generatedAt: new Date(),
        },
      }
    } catch (error) {
      if (options.signal?.aborted) {
        throw new PromptRunnerError('ERR_PROMPT_RUNNER_CANCELLED', false)
      }
      if (error instanceof PromptRunnerError) {
        if (!error.retryable || attempt + 1 >= MAX_ATTEMPTS) throw error
      } else if (attempt + 1 >= MAX_ATTEMPTS) {
        throw new PromptRunnerError('ERR_PROMPT_RUNNER_UNAVAILABLE', true)
      }
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abortFromCaller)
    }
  }

  throw new PromptRunnerError('ERR_PROMPT_RUNNER_UNAVAILABLE', true)
}
