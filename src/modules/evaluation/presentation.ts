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
  return value.filter((item): item is EvaluationEvidence => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return false
    return typeof item.type === 'string' && typeof item.label === 'string'
  })
}

export function evaluationEnvironment(value: Prisma.JsonValue | null | undefined): EvaluationEnvironment {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return value as EvaluationEnvironment
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
