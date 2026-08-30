import {
  AgentReplyAttitude,
  AgentReplyStrategy,
  ArticleSourceKind,
  ArticleStatus,
  CandidateStatus,
  SkillStatus,
} from '@prisma/client'
import * as z from 'zod'

const httpUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'http:' || protocol === 'https:'
}, '必须是 http(s) URL')
const optionalHttpUrl = httpUrl.optional()
const optionalAssetUrl = z.union([
  httpUrl,
  z.string().regex(/^\/(?!\/)/, '必须是 http(s) URL 或站内绝对路径'),
]).optional()
const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(12).optional()
const leaseTokenSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._:-]{15,79}$/)
const mutableCandidateStatusSchema = z.enum(['watching', 'evaluating', 'dropped'])

export const aiAttributionSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  modelVersion: z.string().trim().min(1).max(120),
  generatedAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
})

export const recordInspirationSchema = z.object({
  content: z.string().trim().min(2).max(5000),
  title: z.string().trim().min(2).max(120).optional(),
  summary: z.string().trim().min(2).max(5000).optional(),
  sourceUrl: optionalHttpUrl,
  websiteUrl: optionalHttpUrl,
  previewImageUrl: optionalAssetUrl,
  tags: tagsSchema,
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
})

export const listInspirationsSchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(CandidateStatus).optional(),
  includePromoted: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

export const updateInspirationShape = {
  candidateId: z.string().min(1),
  tags: tagsSchema,
  status: mutableCandidateStatusSchema.optional(),
}

export const updateInspirationSchema = z.object(updateInspirationShape).refine(
  (input) => input.tags !== undefined || input.status !== undefined,
  '至少提供 tags 或 status',
)

export const inspirationToSkillSchema = z.object({
  candidateId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(40),
  summary: z.string().trim().max(240).optional(),
  prompt: z.string().trim().min(8).max(50000),
  effectImageUrl: optionalAssetUrl,
  effectNote: z.string().trim().max(500).optional(),
  sourceUrl: optionalHttpUrl,
  tags: tagsSchema,
  status: z.nativeEnum(SkillStatus).optional(),
})

export const inspirationToAppSchema = z.object({
  candidateId: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  appUrl: httpUrl.optional(),
  title: z.string().trim().min(2).max(120).optional(),
  summary: z.string().trim().min(2).max(240).optional(),
  description: z.string().trim().min(2).max(5000).optional(),
  previewImageUrl: optionalAssetUrl,
  tags: tagsSchema,
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export const publishReviewShape = {
  subjectType: z.enum(['target', 'skill', 'app', 'candidate']),
  subjectId: z.string().min(1).optional(),
  subjectSlug: z.string().trim().min(1).max(160).optional(),
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(3).max(2000),
  language: z.string().trim().min(2).max(16).optional(),
  aiAttribution: aiAttributionSchema,
}

export const publishReviewSchema = z.object(publishReviewShape).refine(
  (input) => Boolean(input.subjectId) !== Boolean(input.subjectSlug),
  'subjectId 和 subjectSlug 必须且只能提供一个',
)

export const publishArticleSchema = z.object({
  title: z.string().trim().min(3).max(120),
  columnSlug: z.string().trim().min(1).max(120).optional(),
  excerpt: z.string().trim().max(200).optional(),
  content: z.string().trim().min(20).max(50000),
  tags: tagsSchema,
  coverImageUrl: optionalAssetUrl,
  status: z.nativeEnum(ArticleStatus).optional(),
  aiAttribution: aiAttributionSchema,
  sources: z.array(z.object({
    kind: z.nativeEnum(ArticleSourceKind),
    label: z.string().trim().min(1).max(160),
    candidateId: z.string().min(1).optional(),
    skillId: z.string().min(1).optional(),
    targetId: z.string().min(1).optional(),
    appId: z.string().min(1).optional(),
    evaluationId: z.string().min(1).optional(),
    reviewId: z.string().min(1).optional(),
    sourceUrl: optionalHttpUrl,
  })).max(24).optional(),
})

export const replyInboxClaimSchema = z.object({
  limit: z.number().int().min(1).max(10).optional(),
  leaseSeconds: z.number().int().min(30).max(900).optional(),
})

export const replyTaskGetSchema = z.object({
  taskId: z.string().min(1),
})

export const replyTaskPlanSchema = z.object({
  taskId: z.string().min(1),
  leaseToken: leaseTokenSchema,
  selectedAgentIds: z.array(
    z.string().trim().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/),
  ).min(1).max(5),
  strategy: z.nativeEnum(AgentReplyStrategy).optional(),
  attitude: z.nativeEnum(AgentReplyAttitude).optional(),
})

export const replyTaskRenewSchema = z.object({
  taskId: z.string().min(1),
  leaseToken: leaseTokenSchema,
  leaseSeconds: z.number().int().min(60).max(900).optional(),
})

export const replyContributeSchema = z.object({
  taskId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
  recommendation: z.string().trim().max(500).optional(),
  aiAttribution: aiAttributionSchema,
  idempotencyKey: z.string().trim().min(8).max(160),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
})

export const replyFinalizeSchema = z.object({
  taskId: z.string().min(1),
  leaseToken: leaseTokenSchema,
  replyAgentId: z.string().trim()
    .regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/)
    .optional(),
  content: z.string().trim().min(1).max(500),
  aiAttribution: aiAttributionSchema,
})

export const replyIgnoreSchema = z.object({
  taskId: z.string().min(1),
  leaseToken: leaseTokenSchema,
  reason: z.string().trim().min(1).max(240),
})
