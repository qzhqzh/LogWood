import { createHash } from 'node:crypto'
import {
  AgentReplyAttitude,
  AgentReplyStrategy,
  ArticleStatus,
  CandidateStatus,
  Prisma,
  SkillStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AiAttributionInput } from '@/modules/ai-attribution'
import { CreateAppInput } from '@/modules/app'
import { createArticle } from '@/modules/article'
import {
  createCandidate,
  findCandidateDuplicate,
  listCandidates,
  organizeCandidate,
  promoteCandidate,
} from '@/modules/candidate'
import { createReview, ReviewSubjectType } from '@/modules/review'
import { CreateSkillInput } from '@/modules/skill'
import { recordAdminAction } from '@/modules/audit'
import {
  claimReplyTasks,
  contributeToReplyTask,
  finalizeReplyTask,
  getReplyInboxStatus,
  getReplyTask,
  ignoreReplyTask,
  planReplyTask,
} from '@/modules/agent-reply'

export interface RecordMcpInspirationInput {
  content: string
  title?: string
  summary?: string
  sourceUrl?: string
  websiteUrl?: string
  previewImageUrl?: string
  tags?: string[]
  idempotencyKey?: string
}

export interface ListMcpInspirationsInput {
  search?: string
  status?: CandidateStatus
  includePromoted?: boolean
  limit?: number
}

export interface UpdateMcpInspirationInput {
  candidateId: string
  tags?: string[]
  status?: CandidateStatus
}

export interface PromoteMcpInspirationToSkillInput {
  candidateId: string
  title: string
  category: string
  summary?: string
  prompt: string
  effectImageUrl?: string
  effectNote?: string
  sourceUrl?: string
  tags?: string[]
  status?: SkillStatus
}

export interface PromoteMcpInspirationToAppInput {
  candidateId: string
  name?: string
  appUrl?: string
  title?: string
  summary?: string
  description?: string
  previewImageUrl?: string
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
}

export interface CreateMcpReviewInput {
  subjectType: ReviewSubjectType
  subjectId?: string
  subjectSlug?: string
  rating: number
  content: string
  language?: string
  aiAttribution: AiAttributionInput
}

export interface CreateMcpArticleInput {
  title: string
  columnSlug?: string
  excerpt?: string
  content: string
  tags?: string[]
  coverImageUrl?: string
  status?: ArticleStatus
  aiAttribution: AiAttributionInput
}

export interface McpReplyPlanInput {
  taskId: string
  leaseToken: string
  selectedAgentIds: string[]
  strategy?: AgentReplyStrategy
  attitude?: AgentReplyAttitude
}

export interface McpReplyContributionInput {
  taskId: string
  content: string
  recommendation?: string
  aiAttribution: AiAttributionInput
  idempotencyKey: string
  inputTokens?: number
  outputTokens?: number
}

export interface McpReplyFinalizeInput {
  taskId: string
  leaseToken: string
  replyAgentId?: string
  content: string
  aiAttribution: AiAttributionInput
}

function normalizeTags(tags?: string[]): string[] {
  const normalized = Array.from(new Set(
    (tags || [])
      .map((tag) => tag.trim().replace(/^#+/, ''))
      .filter(Boolean),
  ))
  if (normalized.length > 12 || normalized.some((tag) => tag.length > 30)) {
    throw new Error('ERR_MCP_TAGS_INVALID')
  }
  return normalized
}

function deriveTitle(content: string): string {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  return (firstLine || content.trim()).slice(0, 120)
}

function buildIdeaKey(input: RecordMcpInspirationInput): string {
  if (input.idempotencyKey?.trim()) {
    return `mcp:${input.idempotencyKey.trim()}`
  }
  return `mcp:${createHash('sha256').update(JSON.stringify({
    content: input.content.trim(),
    title: input.title?.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    websiteUrl: input.websiteUrl?.trim() || null,
  })).digest('hex')}`
}

async function assertOwnedCandidate(candidateId: string, authorUserId: string) {
  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      authorUserId,
    },
    select: { id: true },
  })
  if (!candidate) throw new Error('ERR_CANDIDATE_NOT_FOUND')
}

export async function recordMcpInspiration(
  input: RecordMcpInspirationInput,
  authorUserId: string,
) {
  const content = input.content.trim()
  const title = input.title?.trim() || deriveTitle(content)
  if (content.length < 2 || content.length > 5000 || title.length < 2) {
    throw new Error('ERR_CANDIDATE_VALIDATION')
  }

  const ideaKey = buildIdeaKey(input)
  const duplicate = await findCandidateDuplicate({
    ideaKey,
    title,
    sourceUrl: input.sourceUrl,
    authorUserId,
  })
  if (duplicate) return { candidate: duplicate, created: false }

  try {
    const candidate = await createCandidate({
      title,
      ideaKey,
      summary: input.summary?.trim() || content,
      rawContent: content,
      sourceUrl: input.sourceUrl,
      websiteUrl: input.websiteUrl,
      previewImageUrl: input.previewImageUrl,
      tags: normalizeTags(input.tags),
    }, authorUserId)
    await recordAdminAction({
      actorUserId: authorUserId,
      action: 'mcp.candidate.create',
      targetType: 'candidate',
      targetId: candidate.id,
    })
    return { candidate, created: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const racedDuplicate = await findCandidateDuplicate({
        ideaKey,
        title,
        sourceUrl: input.sourceUrl,
        authorUserId,
      })
      if (racedDuplicate) return { candidate: racedDuplicate, created: false }
    }
    throw error
  }
}

export async function listMcpInspirations(
  input: ListMcpInspirationsInput,
  authorUserId: string,
) {
  return listCandidates({
    search: input.search,
    status: input.status,
    includePromoted: input.includePromoted,
    authorUserId,
    limit: input.limit ?? 30,
  })
}

export async function updateMcpInspiration(
  input: UpdateMcpInspirationInput,
  authorUserId: string,
) {
  if (input.tags === undefined && input.status === undefined) {
    throw new Error('ERR_MCP_UPDATE_REQUIRED')
  }
  await assertOwnedCandidate(input.candidateId, authorUserId)
  const candidate = await organizeCandidate({
    id: input.candidateId,
    tags: input.tags ? normalizeTags(input.tags) : undefined,
    status: input.status,
  })
  await recordAdminAction({
    actorUserId: authorUserId,
    action: 'mcp.candidate.organize',
    targetType: 'candidate',
    targetId: candidate.id,
    metadata: {
      status: input.status,
      tags: input.tags,
    },
  })
  return candidate
}

export async function promoteMcpInspirationToSkill(
  input: PromoteMcpInspirationToSkillInput,
  authorUserId: string,
) {
  await assertOwnedCandidate(input.candidateId, authorUserId)
  const skill: CreateSkillInput = {
    title: input.title,
    category: input.category,
    summary: input.summary,
    prompt: input.prompt,
    effectImageUrl: input.effectImageUrl,
    effectNote: input.effectNote,
    sourceUrl: input.sourceUrl,
    tags: normalizeTags(input.tags),
    status: input.status ?? SkillStatus.published,
  }
  const result = await promoteCandidate({
    id: input.candidateId,
    to: 'skill',
    skill,
  })
  await recordAdminAction({
    actorUserId: authorUserId,
    action: 'mcp.candidate.promote.skill',
    targetType: 'candidate',
    targetId: input.candidateId,
    metadata: { skillId: result.promoted.id },
  })
  return result
}

export async function promoteMcpInspirationToApp(
  input: PromoteMcpInspirationToAppInput,
  authorUserId: string,
) {
  await assertOwnedCandidate(input.candidateId, authorUserId)
  const providedDetails = [
    input.name,
    input.appUrl,
    input.title,
    input.summary,
    input.description,
  ]
  const hasAnyDetails = providedDetails.some((value) => value !== undefined)
  const hasAllDetails = providedDetails.every((value) => value !== undefined)
  const hasSupplementalDetails = input.previewImageUrl !== undefined
    || input.tags !== undefined
    || input.status !== undefined
  if (hasAnyDetails !== hasAllDetails || (!hasAllDetails && hasSupplementalDetails)) {
    throw new Error('ERR_MCP_APP_DETAILS_INCOMPLETE')
  }
  const app: CreateAppInput | undefined = hasAllDetails
    ? {
        name: input.name!,
        appUrl: input.appUrl!,
        title: input.title!,
        summary: input.summary!,
        description: input.description!,
        previewImageUrl: input.previewImageUrl,
        tags: normalizeTags(input.tags),
        status: input.status ?? 'published',
      }
    : undefined
  const result = await promoteCandidate({
    id: input.candidateId,
    to: 'gallery',
    app,
  })
  await recordAdminAction({
    actorUserId: authorUserId,
    action: 'mcp.candidate.promote.app',
    targetType: 'candidate',
    targetId: input.candidateId,
    metadata: { appId: result.promoted.id },
  })
  return result
}

async function resolveReviewSubject(input: {
  subjectType: ReviewSubjectType
  subjectId?: string
  subjectSlug?: string
}) {
  if (input.subjectId) return input.subjectId
  const slug = input.subjectSlug?.trim()
  if (!slug) throw new Error('ERR_REVIEW_VALIDATION')

  if (input.subjectType === 'target') {
    return (await prisma.target.findUnique({ where: { slug }, select: { id: true } }))?.id
  }
  if (input.subjectType === 'skill') {
    return (await prisma.skill.findUnique({ where: { slug }, select: { id: true } }))?.id
  }
  if (input.subjectType === 'app') {
    return (await prisma.app.findUnique({ where: { slug }, select: { id: true } }))?.id
  }
  return (await prisma.candidate.findUnique({ where: { slug }, select: { id: true } }))?.id
}

export async function createMcpReview(
  input: CreateMcpReviewInput,
  authorUserId: string,
) {
  if (Boolean(input.subjectId) === Boolean(input.subjectSlug)) {
    throw new Error('ERR_REVIEW_VALIDATION')
  }
  const subjectId = await resolveReviewSubject(input)
  if (!subjectId) throw new Error('ERR_REVIEW_SUBJECT_NOT_FOUND')

  const review = await createReview({
    subjectType: input.subjectType,
    subjectId,
    rating: input.rating,
    content: input.content,
    language: input.language,
    aiAttribution: input.aiAttribution,
  }, {
    actorType: 'user',
    actorKey: `user:${authorUserId}`,
    userId: authorUserId,
  })
  await recordAdminAction({
    actorUserId: authorUserId,
    action: 'mcp.review.create',
    targetType: 'review',
    targetId: review.id,
    metadata: {
      subjectType: input.subjectType,
      subjectId,
      aiModel: input.aiAttribution.model,
      aiModelVersion: input.aiAttribution.modelVersion,
    },
  })
  return review
}

export async function createMcpArticle(
  input: CreateMcpArticleInput,
  authorUserId: string,
) {
  let columnId: string | undefined
  if (input.columnSlug) {
    const column = await prisma.articleColumn.findUnique({
      where: { slug: input.columnSlug },
      select: { id: true },
    })
    if (!column) throw new Error('ERR_ARTICLE_COLUMN_NOT_FOUND')
    columnId = column.id
  }

  const article = await createArticle({
    title: input.title,
    columnId,
    excerpt: input.excerpt,
    content: input.content,
    tags: normalizeTags(input.tags),
    coverImageUrl: input.coverImageUrl,
    status: input.status ?? ArticleStatus.draft,
    aiAttribution: input.aiAttribution,
  }, authorUserId)
  await recordAdminAction({
    actorUserId: authorUserId,
    action: 'mcp.article.create',
    targetType: 'article',
    targetId: article.id,
    metadata: {
      status: article.status,
      aiModel: input.aiAttribution.model,
      aiModelVersion: input.aiAttribution.modelVersion,
    },
  })
  return article
}

export async function getMcpReplyInboxStatus(authorUserId: string) {
  return getReplyInboxStatus(authorUserId)
}

export async function claimMcpReplyTasks(
  input: { limit?: number; leaseSeconds?: number },
  authorUserId: string,
  agentId: string,
) {
  return claimReplyTasks({
    ownerUserId: authorUserId,
    coordinatorAgentId: agentId,
    limit: input.limit,
    leaseSeconds: input.leaseSeconds,
  })
}

export async function getMcpReplyTask(
  taskId: string,
  authorUserId: string,
) {
  return getReplyTask(taskId, authorUserId)
}

export async function planMcpReplyTask(
  input: McpReplyPlanInput,
  authorUserId: string,
  agentId: string,
) {
  const { leaseToken, ...plan } = input
  return planReplyTask({
    ...plan,
    ownerUserId: authorUserId,
    coordinatorAgentId: agentId,
    leaseOwner: leaseToken,
  })
}

export async function contributeMcpReplyTask(
  input: McpReplyContributionInput,
  authorUserId: string,
  agentId: string,
) {
  return contributeToReplyTask({
    ...input,
    ownerUserId: authorUserId,
    agentId,
  })
}

export async function finalizeMcpReplyTask(
  input: McpReplyFinalizeInput,
  authorUserId: string,
  agentId: string,
) {
  const { leaseToken, ...reply } = input
  const result = await finalizeReplyTask({
    ...reply,
    ownerUserId: authorUserId,
    coordinatorAgentId: agentId,
    leaseOwner: leaseToken,
  })
  await recordAdminAction({
    actorUserId: authorUserId,
    action: 'mcp.reply.finalize',
    targetType: 'agent_reply_task',
    targetId: input.taskId,
    metadata: {
      agentId,
      replyAgentId: input.replyAgentId ?? agentId,
      commentId: result.commentId,
    },
  })
  return result
}

export async function ignoreMcpReplyTask(
  input: { taskId: string; leaseToken: string; reason: string },
  authorUserId: string,
  agentId: string,
) {
  const { leaseToken, ...reply } = input
  return ignoreReplyTask({
    ...reply,
    ownerUserId: authorUserId,
    coordinatorAgentId: agentId,
    leaseOwner: leaseToken,
  })
}
