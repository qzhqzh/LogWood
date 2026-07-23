import type { EvaluationProtocol, Prisma } from '@prisma/client'
import { EVALUATION_PROTOCOLS } from './constants'
import type { EvaluationEnvironment, EvaluationEvidence } from './service'

export function evaluationScores(value: Prisma.JsonValue | null | undefined): Record<string, number> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, score]) => typeof score === 'number' && Number.isFinite(score))
      .map(([key, score]) => [key, score as number]),
  )
}

export function evaluationEvidence(value: Prisma.JsonValue | null | undefined): EvaluationEvidence[] {
  if (!Array.isArray(value)) return []
  const allowedTypes = new Set<EvaluationEvidence['type']>(['url', 'image', 'log', 'code', 'file', 'note'])

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return []
    const raw = item as Prisma.JsonObject
    if (typeof raw.type !== 'string' || !allowedTypes.has(raw.type as EvaluationEvidence['type'])) return []
    if (typeof raw.label !== 'string') return []

    return [{
      type: raw.type as EvaluationEvidence['type'],
      label: raw.label,
      url: typeof raw.url === 'string' ? raw.url : undefined,
      note: typeof raw.note === 'string' ? raw.note : undefined,
    }]
  })
}

export function evaluationEnvironment(value: Prisma.JsonValue | null | undefined): EvaluationEnvironment {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  const raw = value as Prisma.JsonObject
  const stringValue = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : undefined
  return {
    model: stringValue('model'),
    modelVersion: stringValue('modelVersion'),
    software: stringValue('software'),
    softwareVersion: stringValue('softwareVersion'),
    operatingSystem: stringValue('operatingSystem'),
    hardware: stringValue('hardware'),
    notes: stringValue('notes'),
  }
}

export function averageEvaluationScore(scores: Record<string, number>): number | null {
  const values = Object.values(scores)
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, score) => sum + score, 0) / values.length) * 10) / 10
}

export function evaluationScoreRows(protocol: EvaluationProtocol, scores: Record<string, number>) {
  return EVALUATION_PROTOCOLS[protocol].dimensions.map((dimension) => ({
    ...dimension,
    score: scores[dimension.key],
  }))
}
