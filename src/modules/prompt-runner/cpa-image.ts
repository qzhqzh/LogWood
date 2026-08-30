import { readFileSync, statSync } from 'node:fs'
import { PromptRunnerError } from './error'

const DEFAULT_BASE_URL = 'http://127.0.0.1:31000/v1'
const REQUEST_TIMEOUT_MS = 180_000
const MAX_CONFIG_BYTES = 1024 * 1024
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024
const MAX_IMAGE_BYTES = 16 * 1024 * 1024
const MAX_IMAGE_EDGE = 8_192
const MAX_IMAGE_PIXELS = 40_000_000

type CpaImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface CpaImageEnvironment {
  [key: string]: string | undefined
  CPA_API_KEY?: string
  CPA_CONFIG_FILE?: string
  CPA_BASE_URL?: string
  CPA_HTTP_ALLOWED_HOSTS?: string
}

export interface CpaImageResult {
  dataUrl: string
  mimeType: CpaImageMimeType
  width: number
  height: number
  model: string
  requestId?: string
}

interface GenerateCpaImageOptions {
  apiKey?: string
  baseUrl?: string
  allowedHttpHosts?: string
  model: string
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

interface CpaImageEnvelope {
  id?: string
  model?: string
  choices?: Array<{
    message?: {
      images?: Array<{
        image_url?: string | { url?: string }
      }>
    }
  }>
}

export function parseCpaApiKey(config: string) {
  const lines = config.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^api-keys:\s*(.*?)\s*$/)
    if (!match) continue

    const inline = match[1]
    if (inline) {
      try {
        const values = JSON.parse(inline) as unknown
        if (Array.isArray(values) && typeof values[0] === 'string') {
          return validKey(values[0])
        }
      } catch {
        return undefined
      }
    }

    for (let child = index + 1; child < lines.length; child += 1) {
      const line = lines[child]
      if (!line.trim() || /^\s*#/.test(line)) continue
      if (!/^\s/.test(line)) break
      const item = line.match(/^\s+-\s+(.+?)\s*$/)
      if (!item) continue
      return validKey(parseYamlScalar(item[1]))
    }
    return undefined
  }
  return undefined
}

export function getCpaApiKey(
  env: CpaImageEnvironment = process.env,
) {
  const directKey = validKey(env.CPA_API_KEY)
  if (directKey) return directKey

  const configFile = env.CPA_CONFIG_FILE?.trim()
  if (!configFile) return undefined
  try {
    if (statSync(configFile).size > MAX_CONFIG_BYTES) return undefined
    return parseCpaApiKey(readFileSync(configFile, 'utf8'))
  } catch {
    return undefined
  }
}

export function isCpaImageConfigured(
  env: CpaImageEnvironment = process.env,
) {
  return Boolean(getCpaApiKey(env))
}

export async function generateCpaImage(
  prompt: string,
  options: GenerateCpaImageOptions,
): Promise<CpaImageResult> {
  const apiKey = options.apiKey ?? getCpaApiKey()
  if (!apiKey) throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)

  const url = cpaEndpoint(
    options.baseUrl ?? process.env.CPA_BASE_URL ?? DEFAULT_BASE_URL,
    options.allowedHttpHosts ?? process.env.CPA_HTTP_ALLOWED_HOSTS,
  )
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abortFromCaller()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: prompt.trim() }],
        }],
      }),
      signal: controller.signal,
    })
    const raw = await readBoundedText(response, MAX_RESPONSE_BYTES)

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new PromptRunnerError('ERR_PROMPT_RUNNER_AUTH', false)
      }
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      throw new PromptRunnerError('ERR_PROMPT_RUNNER_UNAVAILABLE', retryable)
    }

    let envelope: CpaImageEnvelope
    try {
      envelope = JSON.parse(raw) as CpaImageEnvelope
    } catch {
      throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', true)
    }

    const imageUrl = envelope.choices?.[0]?.message?.images?.[0]?.image_url
    const dataUrl = typeof imageUrl === 'string' ? imageUrl : imageUrl?.url
    if (!dataUrl) throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', true)

    const image = decodeImageDataUrl(dataUrl)
    const dimensions = imageDimensions(image.data, image.mimeType)
    return {
      dataUrl: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
      mimeType: image.mimeType,
      ...dimensions,
      model: envelope.model?.trim() || options.model,
      requestId: envelope.id,
    }
  } catch (error) {
    if (error instanceof PromptRunnerError) throw error
    if (options.signal?.aborted) {
      throw new PromptRunnerError('ERR_PROMPT_RUNNER_CANCELLED', false)
    }
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_UNAVAILABLE', true)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

function validKey(value?: string) {
  const key = value?.trim()
  return key && key.length <= 4_096 ? key : undefined
}

function parseYamlScalar(value: string) {
  const withoutComment = value.replace(/\s+#.*$/, '').trim()
  if (withoutComment.startsWith('"') && withoutComment.endsWith('"')) {
    try {
      return JSON.parse(withoutComment) as string
    } catch {
      return ''
    }
  }
  if (withoutComment.startsWith("'") && withoutComment.endsWith("'")) {
    return withoutComment.slice(1, -1).replace(/''/g, "'")
  }
  return withoutComment
}

function cpaEndpoint(baseUrl: string, allowedHttpHosts?: string) {
  try {
    const parsed = new URL(baseUrl.trim())
    const path = parsed.pathname.replace(/\/+$/, '')
    const hostname = parsed.hostname.toLocaleLowerCase('en-US').replace(/^\[|\]$/g, '')
    const allowedHosts = new Set((allowedHttpHosts ?? '')
      .split(',')
      .map((host) => host.trim().toLocaleLowerCase('en-US').replace(/^\[|\]$/g, ''))
      .filter(Boolean))
    const loopback = hostname === 'localhost'
      || hostname === '::1'
      || /^127(?:\.\d{1,3}){3}$/.test(hostname)
    const secure = parsed.protocol === 'https:'
      || (parsed.protocol === 'http:' && (loopback || allowedHosts.has(hostname)))

    if (
      !secure
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (path !== '' && path !== '/v1')
    ) {
      throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)
    }
    parsed.pathname = '/v1/chat/completions'
    return parsed.toString()
  } catch (error) {
    if (error instanceof PromptRunnerError) throw error
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_NOT_CONFIGURED', false)
  }
}

function decodeImageDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/)
  if (!match) throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
  const encoded = match[2].replace(/[\r\n]/g, '')
  if (encoded.length === 0 || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) {
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
  }
  const data = Buffer.from(encoded, 'base64')
  if (
    data.length === 0
    || data.length > MAX_IMAGE_BYTES
    || data.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')
  ) {
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
  }
  const mimeType = match[1] as CpaImageMimeType
  assertMagic(data, mimeType)
  return { data, mimeType }
}

function assertMagic(data: Buffer, mimeType: CpaImageMimeType) {
  const valid = mimeType === 'image/jpeg'
    ? data[0] === 0xff && data[1] === 0xd8
    : mimeType === 'image/png'
      ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : data.subarray(0, 4).toString('ascii') === 'RIFF'
        && data.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!valid) throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
}

function imageDimensions(data: Buffer, mimeType: CpaImageMimeType) {
  let dimensions: { width: number; height: number } | undefined
  if (mimeType === 'image/png') {
    if (data.length < 24) throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
    dimensions = { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }
  if (!dimensions && mimeType === 'image/jpeg') {
    let offset = 2
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) {
        offset += 1
        continue
      }
      const marker = data[offset + 1]
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        dimensions = { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) }
        break
      }
      const length = data.readUInt16BE(offset + 2)
      if (length < 2) break
      offset += 2 + length
    }
  }
  if (
    !dimensions
    && mimeType === 'image/webp'
    && data.length >= 30
    && data.subarray(12, 16).toString('ascii') === 'VP8X'
  ) {
    dimensions = {
      width: 1 + data[24] + (data[25] << 8) + (data[26] << 16),
      height: 1 + data[27] + (data[28] << 8) + (data[29] << 16),
    }
  }
  if (
    !dimensions
    || dimensions.width < 1
    || dimensions.height < 1
    || dimensions.width > MAX_IMAGE_EDGE
    || dimensions.height > MAX_IMAGE_EDGE
    || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
  }
  return dimensions
}

async function readBoundedText(response: Response, limit: number) {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > limit) {
    throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel()
        throw new PromptRunnerError('ERR_PROMPT_RUNNER_INVALID_RESPONSE', false)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return new TextDecoder().decode(Buffer.concat(chunks, total))
}
