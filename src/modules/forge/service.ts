import { createHash } from 'node:crypto'
import {
  ArticleSourceKind,
  ArticleStatus,
  ForgeRequestStatus,
  Prisma,
  SkillStatus,
  TargetType,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createArticle } from '@/modules/article'
import { createSkill } from '@/modules/skill'
import { ForgeProviderError, generateForgeDraft } from './provider'

export type ForgeDraftKind = 'article' | 'skill'
export type ForgeDraftMode = 'ai' | 'local'

export interface ForgeDraftInput {
  kind: ForgeDraftKind
  prompt: string
  title?: string
  category?: string
  /** @deprecated Legacy Forge clients sent a TargetType. */
  type?: TargetType
  sourceUrl?: string
  sourceCandidateId?: string
  mode?: ForgeDraftMode
}

export interface ForgeDraftResult {
  kind: ForgeDraftKind
  mode: ForgeDraftMode
  title: string
  content: string
  excerpt?: string
  saved: { id: string; slug: string; href: string }
  attribution?: {
    provider: string
    model: string
    modelVersion: string
    generatedAt: string
  }
  note: string
}

export class ForgeRequestError extends Error {
  constructor(
    public readonly code:
      | 'ERR_FORGE_IDEMPOTENCY_CONFLICT'
      | 'ERR_FORGE_IN_PROGRESS'
      | 'ERR_FORGE_RETRY_EXHAUSTED',
    public readonly retryable: boolean,
  ) {
    super(code)
    this.name = 'ForgeRequestError'
  }
}

function synthesizeLocally(prompt: string, titleHint?: string) {
  const cleaned = prompt.trim().replace(/\s+/g, ' ')
  const title = (titleHint?.trim() || cleaned.slice(0, 40) || '未命名草稿').trim()
  const excerpt = cleaned.slice(0, 120)
  const content = [
    `<p>${cleaned}</p>`,
    '<p><em>（本地模板草稿：未调用模型，事实、证据与结论仍需人工补充。）</em></p>',
  ].join('\n')
  return { title, excerpt, content, description: cleaned.slice(0, 500), tags: ['本地模板'] }
}

function categoryFromLegacyType(type?: TargetType): string {
  if (type === TargetType.editor || type === TargetType.coding) return 'workflow'
  if (type === TargetType.model) return 'other'
  return 'workflow'
}

export async function createForgeDraft(
  input: ForgeDraftInput,
  authorUserId: string,
): Promise<ForgeDraftResult> {
  const prompt = input.prompt.trim()
  if (prompt.length < 8) throw new Error('ERR_FORGE_PROMPT_TOO_SHORT')
  const mode = input.mode ?? 'ai'
  const generated = mode === 'ai'
    ? await generateForgeDraft({ kind: input.kind, prompt, title: input.title })
    : synthesizeLocally(prompt, input.title)
  const attribution = 'attribution' in generated ? generated.attribution : undefined
  const resultAttribution = attribution ? {
    provider: attribution.provider,
    model: attribution.model,
    modelVersion: attribution.modelVersion,
    generatedAt: (attribution.generatedAt || new Date()).toISOString(),
  } : undefined

  if (input.kind === 'article') {
    const article = await createArticle({
      title: generated.title,
      excerpt: generated.excerpt,
      content: generated.content,
      tags: [...generated.tags, '协作草稿'],
      status: ArticleStatus.draft,
      aiAttribution: attribution,
      contributionRole: attribution ? 'AI drafting' : 'Local template',
      changeSummary: attribution ? 'Forge AI draft' : 'Forge local template draft',
      sources: input.sourceCandidateId ? [{
        kind: ArticleSourceKind.inspiration,
        label: '造物台来源灵感',
        candidateId: input.sourceCandidateId,
      }] : undefined,
    }, authorUserId)
    return {
      kind: 'article',
      mode,
      title: generated.title,
      content: generated.content,
      excerpt: generated.excerpt,
      saved: { id: article.id, slug: article.slug, href: '/articles/manage' },
      attribution: resultAttribution,
      note: attribution
        ? 'AI 结果已带完整归属写入洞笔记草稿；需人工审核当前版本后才能发布。'
        : '本地模板已写入洞笔记草稿；需人工补充并审核当前版本后才能发布。',
    }
  }

  const skill = await createSkill({
    title: generated.title.slice(0, 120),
    category: input.category?.trim() || categoryFromLegacyType(input.type),
    summary: generated.excerpt,
    prompt: generated.content,
    sourceUrl: input.sourceUrl,
    tags: [...generated.tags, '协作草稿'],
    status: SkillStatus.draft,
    aiAttribution: attribution,
  }, authorUserId)
  return {
    kind: 'skill',
    mode,
    title: generated.title,
    content: generated.content,
    saved: { id: skill.id, slug: skill.slug, href: `/skills/manage?edit=${skill.id}` },
    attribution: resultAttribution,
    note: attribution
      ? 'AI 结果已带完整归属写入 Skill 草稿，仍需人工补充适用边界与验证记录。'
      : '本地模板已写入 Skill 草稿，仍需人工补充适用边界与验证记录。',
  }
}

function requestIdentity(input: ForgeDraftInput, authorUserId: string) {
  const normalized = JSON.stringify({
    authorUserId,
    kind: input.kind,
    prompt: input.prompt.trim(),
    title: input.title?.trim() || null,
    category: input.category?.trim() || null,
    type: input.type || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    sourceCandidateId: input.sourceCandidateId || null,
    mode: input.mode ?? 'ai',
  })
  return createHash('sha256').update(normalized).digest('hex')
}

function jsonPayload(result: ForgeDraftResult): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue
}

export async function createIdempotentForgeDraft(
  input: ForgeDraftInput,
  authorUserId: string,
  requestedKey?: string,
): Promise<ForgeDraftResult> {
  const inputHash = requestIdentity(input, authorUserId)
  const idempotencyKey = requestedKey?.trim() || `auto:${inputHash}`
  if (idempotencyKey.length < 8 || idempotencyKey.length > 180) {
    throw new ForgeRequestError('ERR_FORGE_IDEMPOTENCY_CONFLICT', false)
  }

  let request = await prisma.forgeDraftRequest.findUnique({
    where: { ownerUserId_idempotencyKey: { ownerUserId: authorUserId, idempotencyKey } },
  })
  if (request && request.inputHash !== inputHash) {
    throw new ForgeRequestError('ERR_FORGE_IDEMPOTENCY_CONFLICT', false)
  }
  if (request?.status === ForgeRequestStatus.completed && request.resultPayload) {
    return request.resultPayload as unknown as ForgeDraftResult
  }
  if (request?.status === ForgeRequestStatus.processing) {
    const staleBefore = Date.now() - 5 * 60 * 1000
    if (request.updatedAt.getTime() > staleBefore) {
      throw new ForgeRequestError('ERR_FORGE_IN_PROGRESS', true)
    }
  }
  if (request && request.attempts >= 3) {
    throw new ForgeRequestError('ERR_FORGE_RETRY_EXHAUSTED', false)
  }

  if (request) {
    request = await prisma.forgeDraftRequest.update({
      where: { id: request.id },
      data: {
        status: ForgeRequestStatus.processing,
        attempts: { increment: 1 },
        errorCode: null,
      },
    })
  } else {
    try {
      request = await prisma.forgeDraftRequest.create({
        data: {
          ownerUserId: authorUserId,
          idempotencyKey,
          inputHash,
          kind: input.kind,
          mode: input.mode ?? 'ai',
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return createIdempotentForgeDraft(input, authorUserId, idempotencyKey)
      }
      throw error
    }
  }

  try {
    const result = await createForgeDraft(input, authorUserId)
    await prisma.forgeDraftRequest.update({
      where: { id: request.id },
      data: {
        status: ForgeRequestStatus.completed,
        resultArticleId: result.kind === 'article' ? result.saved.id : null,
        resultSkillId: result.kind === 'skill' ? result.saved.id : null,
        resultPayload: jsonPayload(result),
        aiProvider: result.attribution?.provider,
        aiModel: result.attribution?.model,
        aiModelVersion: result.attribution?.modelVersion,
        aiGeneratedAt: result.attribution ? new Date(result.attribution.generatedAt) : null,
        errorCode: null,
      },
    })
    return result
  } catch (error) {
    const code = error instanceof Error && /^ERR_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'ERR_FORGE_FAILED'
    await prisma.forgeDraftRequest.update({
      where: { id: request.id },
      data: { status: ForgeRequestStatus.failed, errorCode: code },
    })
    throw error
  }
}

export function forgeErrorDetails(error: unknown) {
  if (error instanceof ForgeProviderError || error instanceof ForgeRequestError) {
    return { code: error.code, retryable: error.retryable }
  }
  if (error instanceof Error && error.message === 'ERR_FORGE_PROMPT_TOO_SHORT') {
    return { code: error.message, retryable: false }
  }
  return { code: 'ERR_FORGE_FAILED', retryable: true }
}
