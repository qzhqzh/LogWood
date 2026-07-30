export interface AiAttributionInput {
  provider: string
  model: string
  modelVersion: string
  generatedAt?: Date
}

export interface AiAttributionData {
  aiProvider: string | null
  aiModel: string | null
  aiModelVersion: string | null
  aiGeneratedAt: Date | null
}

const MAX_PROVIDER_LENGTH = 80
const MAX_MODEL_LENGTH = 120
const MAX_VERSION_LENGTH = 120
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

function normalizeRequired(value: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    throw new Error('ERR_AI_ATTRIBUTION_INVALID')
  }
  return normalized
}

export function normalizeAiAttribution(
  input?: AiAttributionInput,
  now: Date = new Date(),
): AiAttributionData {
  if (!input) {
    return {
      aiProvider: null,
      aiModel: null,
      aiModelVersion: null,
      aiGeneratedAt: null,
    }
  }

  const generatedAt = input.generatedAt ?? now
  if (
    Number.isNaN(generatedAt.getTime())
    || generatedAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS
  ) {
    throw new Error('ERR_AI_ATTRIBUTION_INVALID')
  }

  return {
    aiProvider: normalizeRequired(input.provider, MAX_PROVIDER_LENGTH),
    aiModel: normalizeRequired(input.model, MAX_MODEL_LENGTH),
    aiModelVersion: normalizeRequired(input.modelVersion, MAX_VERSION_LENGTH),
    aiGeneratedAt: generatedAt,
  }
}
