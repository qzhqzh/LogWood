import { ArticleStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createCandidate } from '@/modules/candidate'
import { sanitizeArticleHtml } from '@/modules/article/sanitize'
import { generateThoughtReply, ThoughtProviderError } from './provider'
import type {
  ThoughtArticlePreview,
  ThoughtSession,
  ThoughtSessionSummary,
  ThoughtTurn,
} from './types'

export const THOUGHT_SESSION_TAG = 'thought-session'
const THOUGHT_SESSION_SCHEMA = 'logwood.thought-session.v1'
const MAX_STORED_PAYLOAD_LENGTH = 48_000

const thoughtPayloadSchema = z.object({
  schema: z.literal(THOUGHT_SESSION_SCHEMA),
  turns: z.array(z.object({
    id: z.string().min(1).max(180),
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(8000),
    createdAt: z.string().datetime({ offset: true }),
    replyTo: z.string().min(1).max(180).optional(),
    attribution: z.object({
      provider: z.string().min(1).max(80),
      model: z.string().min(1).max(120),
      modelVersion: z.string().min(1).max(120),
      generatedAt: z.string().datetime({ offset: true }),
    }).optional(),
  })).max(120),
})

type ThoughtPayload = z.infer<typeof thoughtPayloadSchema>

interface ArticleRecord {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  tags: string
  status: 'draft' | 'published' | 'archived'
  reviewStatus: 'pending' | 'approved' | 'changes_requested'
  currentVersion: number
  approvedVersion: number | null
  updatedAt: Date
  publishedAt: Date | null
  aiProvider: string | null
  aiModel: string | null
  aiModelVersion: string | null
  aiGeneratedAt: Date | null
}

function parsePayload(rawContent: string | null): ThoughtPayload {
  try {
    return thoughtPayloadSchema.parse(JSON.parse(rawContent || ''))
  } catch {
    throw new Error('ERR_THOUGHT_SESSION_CORRUPT')
  }
}

function serializePayload(payload: ThoughtPayload): string {
  const serialized = JSON.stringify(payload)
  if (serialized.length > MAX_STORED_PAYLOAD_LENGTH) {
    throw new Error('ERR_THOUGHT_SESSION_FULL')
  }
  return serialized
}

function parseTags(tags: string): string[] {
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : []
  } catch {
    return []
  }
}

function titleFrom(content: string): string {
  const title = content.trim().replace(/\s+/g, ' ').slice(0, 42)
  return title.length >= 2 ? title : '一则新想法'
}

function summaryFrom(turns: ThoughtTurn[]): string | null {
  const lastUserTurn = [...turns].reverse().find((turn) => turn.role === 'user')
  return lastUserTurn?.content.trim().replace(/\s+/g, ' ').slice(0, 240) || null
}

function toArticlePreview(article: ArticleRecord | null): ThoughtArticlePreview | null {
  if (!article) return null
  const hasAttribution = Boolean(
    article.aiProvider
    && article.aiModel
    && article.aiModelVersion
    && article.aiGeneratedAt,
  )
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    contentHtml: sanitizeArticleHtml(article.content),
    tags: parseTags(article.tags),
    status: article.status,
    reviewStatus: article.reviewStatus,
    currentVersion: article.currentVersion,
    approvedVersion: article.approvedVersion,
    updatedAt: article.updatedAt.toISOString(),
    publishedAt: article.publishedAt?.toISOString() || null,
    attribution: hasAttribution ? {
      provider: article.aiProvider!,
      model: article.aiModel!,
      modelVersion: article.aiModelVersion!,
      generatedAt: article.aiGeneratedAt!.toISOString(),
    } : undefined,
  }
}

const articleSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  tags: true,
  status: true,
  reviewStatus: true,
  currentVersion: true,
  approvedVersion: true,
  updatedAt: true,
  publishedAt: true,
  aiProvider: true,
  aiModel: true,
  aiModelVersion: true,
  aiGeneratedAt: true,
} as const

async function findLinkedArticle(candidateId: string): Promise<ArticleRecord | null> {
  return prisma.article.findFirst({
    where: {
      status: { not: ArticleStatus.archived },
      sources: { some: { candidateId } },
    },
    orderBy: { updatedAt: 'desc' },
    select: articleSelect,
  }) as Promise<ArticleRecord | null>
}

async function findOwnedThoughtCandidate(id: string, authorUserId: string) {
  const candidate = await prisma.candidate.findFirst({
    where: {
      id,
      authorUserId,
      tags: { contains: `"${THOUGHT_SESSION_TAG}"` },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      rawContent: true,
      updatedAt: true,
    },
  })
  if (!candidate) throw new Error('ERR_THOUGHT_SESSION_NOT_FOUND')
  return candidate
}

export async function listThoughtSessions(
  authorUserId: string,
  limit = 30,
): Promise<ThoughtSessionSummary[]> {
  const candidates = await prisma.candidate.findMany({
    where: {
      authorUserId,
      tags: { contains: `"${THOUGHT_SESSION_TAG}"` },
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 60),
    select: {
      id: true,
      title: true,
      summary: true,
      rawContent: true,
      updatedAt: true,
    },
  })

  const candidateIds = candidates.map((candidate) => candidate.id)
  const linkedArticles = candidateIds.length > 0
    ? await prisma.article.findMany({
        where: {
          status: { not: ArticleStatus.archived },
          sources: { some: { candidateId: { in: candidateIds } } },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          ...articleSelect,
          sources: {
            where: { candidateId: { in: candidateIds } },
            select: { candidateId: true },
          },
        },
      })
    : []
  const articleByCandidate = new Map<string, ArticleRecord>()
  for (const article of linkedArticles) {
    for (const source of article.sources) {
      if (source.candidateId && !articleByCandidate.has(source.candidateId)) {
        articleByCandidate.set(source.candidateId, article as ArticleRecord)
      }
    }
  }

  return candidates.map((candidate) => {
    const payload = parsePayload(candidate.rawContent)
    const article = toArticlePreview(articleByCandidate.get(candidate.id) || null)
    return {
      id: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      turnCount: payload.turns.length,
      updatedAt: candidate.updatedAt.toISOString(),
      article: article ? {
        id: article.id,
        title: article.title,
        slug: article.slug,
        status: article.status,
        currentVersion: article.currentVersion,
        updatedAt: article.updatedAt,
      } : null,
    }
  })
}

export async function getThoughtSession(
  id: string,
  authorUserId: string,
): Promise<ThoughtSession> {
  const candidate = await findOwnedThoughtCandidate(id, authorUserId)
  const payload = parsePayload(candidate.rawContent)
  const article = toArticlePreview(await findLinkedArticle(candidate.id))
  return {
    id: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    turnCount: payload.turns.length,
    updatedAt: candidate.updatedAt.toISOString(),
    turns: payload.turns,
    article,
  }
}

async function saveThoughtPayload(input: {
  candidateId: string
  payload: ThoughtPayload
  title?: string
}) {
  return prisma.candidate.update({
    where: { id: input.candidateId },
    data: {
      rawContent: serializePayload(input.payload),
      summary: summaryFrom(input.payload.turns),
      title: input.title,
    },
    select: { id: true },
  })
}

async function createThoughtCandidate(
  turn: ThoughtTurn,
  authorUserId: string,
) {
  return createCandidate({
    title: titleFrom(turn.content),
    summary: summaryFrom([turn]) || undefined,
    rawContent: serializePayload({
      schema: THOUGHT_SESSION_SCHEMA,
      turns: [turn],
    }),
    tags: [THOUGHT_SESSION_TAG, '思想对话'],
    visibility: 'private',
  }, authorUserId)
}

export interface AppendThoughtMessageInput {
  sessionId?: string
  requestId: string
  content: string
  action: 'chat' | 'record'
}

export interface AppendThoughtMessageResult {
  session: ThoughtSession
  error?: ThoughtProviderError['code']
  retryable?: boolean
}

export async function appendThoughtMessage(
  input: AppendThoughtMessageInput,
  authorUserId: string,
): Promise<AppendThoughtMessageResult> {
  const content = input.content.trim()
  const requestId = input.requestId.trim()
  if (content.length < 2 || content.length > 4000) {
    throw new Error('ERR_THOUGHT_MESSAGE_INVALID')
  }
  if (!/^[a-z0-9][a-z0-9._:-]{7,179}$/i.test(requestId)) {
    throw new Error('ERR_THOUGHT_REQUEST_INVALID')
  }

  const userTurn: ThoughtTurn = {
    id: requestId,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  }

  let sessionId = input.sessionId
  if (!sessionId) {
    const candidate = await createThoughtCandidate(userTurn, authorUserId)
    sessionId = candidate.id
  } else {
    const candidate = await findOwnedThoughtCandidate(sessionId, authorUserId)
    const payload = parsePayload(candidate.rawContent)
    if (!payload.turns.some((turn) => turn.id === requestId)) {
      payload.turns.push(userTurn)
      await saveThoughtPayload({ candidateId: sessionId, payload })
    }
  }

  if (input.action === 'record') {
    return { session: await getThoughtSession(sessionId, authorUserId) }
  }

  const candidate = await findOwnedThoughtCandidate(sessionId, authorUserId)
  const payload = parsePayload(candidate.rawContent)
  if (payload.turns.some((turn) => turn.role === 'assistant' && turn.replyTo === requestId)) {
    return { session: await getThoughtSession(sessionId, authorUserId) }
  }

  try {
    const reply = await generateThoughtReply(payload.turns)
    const latest = await findOwnedThoughtCandidate(sessionId, authorUserId)
    const latestPayload = parsePayload(latest.rawContent)
    if (!latestPayload.turns.some((turn) => turn.role === 'assistant' && turn.replyTo === requestId)) {
      latestPayload.turns.push({
        id: `${requestId}:reply`,
        role: 'assistant',
        content: reply.content,
        createdAt: reply.attribution.generatedAt,
        replyTo: requestId,
        attribution: reply.attribution,
      })
      await saveThoughtPayload({ candidateId: sessionId, payload: latestPayload })
    }
    return { session: await getThoughtSession(sessionId, authorUserId) }
  } catch (error) {
    if (error instanceof ThoughtProviderError) {
      return {
        session: await getThoughtSession(sessionId, authorUserId),
        error: error.code,
        retryable: error.retryable,
      }
    }
    throw error
  }
}

export async function buildThoughtDraftInput(
  sessionId: string,
  authorUserId: string,
) {
  const session = await getThoughtSession(sessionId, authorUserId)
  if (session.turns.length === 0) throw new Error('ERR_THOUGHT_SESSION_EMPTY')

  const transcript = session.turns.map((turn) => {
    const speaker = turn.role === 'user' ? '作者' : '思想协作者'
    return `【${speaker}】\n${turn.content}`
  }).join('\n\n')

  return {
    title: session.article?.title || session.title,
    articleId: session.article?.id,
    sourceCandidateId: session.id,
    prompt: [
      '以下是一段持续讨论的完整记录。请把其中已经形成的主张、理由、例子和保留意见整理成一篇可独立阅读的中文文章。',
      '不要虚构事实或来源；仍未确定的判断要保留诚实边界。文章应有清楚的推进，而不是逐轮复述对话。',
      transcript,
    ].join('\n\n'),
  }
}
