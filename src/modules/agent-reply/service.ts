import { randomBytes } from 'node:crypto'
import {
  AgentReplyAttitude,
  AgentReplyStrategy,
  AgentReplyTaskStatus,
  CommentStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  AiAttributionInput,
  normalizeAiAttribution,
} from '@/modules/ai-attribution'
import { assessGeneratedReply } from './policy'

const DEFAULT_LEASE_SECONDS = 120
const MAX_LEASE_SECONDS = 900
const COLLECTING_LEASE_SECONDS = 600
const MAX_REPLY_LENGTH = 500
const MAX_CONTRIBUTION_LENGTH = 4000
const MAX_AGENT_COUNT = 5
const MAX_FAILURE_ATTEMPTS = 6
const RETRYABLE_FAILURES = new Set([
  'ERR_REPLY_COUNCIL_FAILED',
  'ERR_TOTEMORA_CHAT_FAILED',
  'ERR_TOTEMORA_EMPTY_REPLY',
  'ERR_TOTEMORA_TRIBE_UNAVAILABLE',
])

function normalizeAgentId(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(normalized)) {
    throw new Error('ERR_AGENT_ID_INVALID')
  }
  return normalized
}

function normalizeSelectedAgents(agentIds: string[]): string[] {
  const normalized = Array.from(new Set(agentIds.map(normalizeAgentId)))
  if (normalized.length === 0 || normalized.length > MAX_AGENT_COUNT) {
    throw new Error('ERR_REPLY_PLAN_INVALID')
  }
  return normalized
}

function activeTaskWhere(ownerUserId: string, taskId: string) {
  return {
    id: taskId,
    ownerUserId,
    status: {
      in: [
        AgentReplyTaskStatus.claimed,
        AgentReplyTaskStatus.collecting,
      ],
    },
    leaseUntil: { gt: new Date() },
  }
}

export async function getReplyInboxStatus(ownerUserId: string) {
  const [pending, claimed, collecting, failed] = await Promise.all([
    prisma.agentReplyTask.count({
      where: { ownerUserId, status: AgentReplyTaskStatus.pending },
    }),
    prisma.agentReplyTask.count({
      where: { ownerUserId, status: AgentReplyTaskStatus.claimed },
    }),
    prisma.agentReplyTask.count({
      where: { ownerUserId, status: AgentReplyTaskStatus.collecting },
    }),
    prisma.agentReplyTask.count({
      where: { ownerUserId, status: AgentReplyTaskStatus.failed },
    }),
  ])
  return {
    pending,
    claimed,
    collecting,
    failed,
    actionable: pending + claimed + collecting,
  }
}

export async function claimReplyTasks(input: {
  ownerUserId: string
  coordinatorAgentId: string
  leaseOwner?: string
  limit?: number
  leaseSeconds?: number
}) {
  const coordinatorAgentId = normalizeAgentId(input.coordinatorAgentId)
  const leaseOwner = normalizeAgentId(
    input.leaseOwner ?? randomBytes(24).toString('hex'),
  )
  const limit = Math.min(Math.max(input.limit ?? 1, 1), 10)
  const leaseSeconds = Math.min(
    Math.max(input.leaseSeconds ?? DEFAULT_LEASE_SECONDS, 30),
    MAX_LEASE_SECONDS,
  )
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000)
  const claimable = {
    ownerUserId: input.ownerUserId,
    OR: [
      {
        status: AgentReplyTaskStatus.pending,
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: now } },
        ],
      },
      {
        status: {
          in: [
            AgentReplyTaskStatus.claimed,
            AgentReplyTaskStatus.collecting,
          ],
        },
        OR: [
          { leaseUntil: null },
          { leaseUntil: { lt: now } },
        ],
      },
    ],
  }

  const candidates = await prisma.agentReplyTask.findMany({
    where: claimable,
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
    take: limit * 3,
    select: { id: true },
  })

  const claimedIds: string[] = []
  for (const candidate of candidates) {
    if (claimedIds.length >= limit) break
    const result = await prisma.agentReplyTask.updateMany({
      where: {
        id: candidate.id,
        ...claimable,
      },
      data: {
        status: AgentReplyTaskStatus.claimed,
        coordinatorAgentId,
        leaseOwner,
        leaseUntil,
        attempts: { increment: 1 },
        nextAttemptAt: null,
        lastError: null,
      },
    })
    if (result.count === 1) claimedIds.push(candidate.id)
  }

  if (claimedIds.length === 0) return []
  const tasks = await prisma.agentReplyTask.findMany({
    where: { id: { in: claimedIds } },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })
  return tasks.map(({ leaseOwner: taskLeaseOwner, ...task }) => ({
    ...task,
    leaseToken: taskLeaseOwner,
  }))
}

export async function getReplyTask(taskId: string, ownerUserId: string) {
  const task = await prisma.agentReplyTask.findFirst({
    where: { id: taskId, ownerUserId },
    include: {
      reviewComment: {
        select: {
          id: true,
          content: true,
          language: true,
          createdAt: true,
          review: {
            select: { id: true, content: true },
          },
        },
      },
      articleComment: {
        select: {
          id: true,
          content: true,
          language: true,
          createdAt: true,
          article: {
            select: { id: true, slug: true, title: true, excerpt: true },
          },
        },
      },
      contributions: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!task) throw new Error('ERR_REPLY_TASK_NOT_FOUND')
  const { leaseOwner: _leaseOwner, ...publicTask } = task
  return publicTask
}

export async function planReplyTask(input: {
  taskId: string
  ownerUserId: string
  coordinatorAgentId: string
  leaseOwner?: string
  selectedAgentIds: string[]
  strategy?: AgentReplyStrategy
  attitude?: AgentReplyAttitude
}) {
  const coordinatorAgentId = normalizeAgentId(input.coordinatorAgentId)
  const leaseOwner = normalizeAgentId(input.leaseOwner ?? coordinatorAgentId)
  const task = await prisma.agentReplyTask.findFirst({
    where: activeTaskWhere(input.ownerUserId, input.taskId),
    select: { id: true, coordinatorAgentId: true, leaseOwner: true },
  })
  if (!task) throw new Error('ERR_REPLY_TASK_NOT_ACTIONABLE')
  if (task.coordinatorAgentId && task.coordinatorAgentId !== coordinatorAgentId) {
    throw new Error('ERR_REPLY_TASK_LEASED')
  }
  if (task.leaseOwner && task.leaseOwner !== leaseOwner) {
    throw new Error('ERR_REPLY_TASK_LEASED')
  }

  const result = await prisma.agentReplyTask.updateMany({
    where: {
      ...activeTaskWhere(input.ownerUserId, task.id),
      coordinatorAgentId: task.coordinatorAgentId,
      leaseOwner: task.leaseOwner,
    },
    data: {
      status: AgentReplyTaskStatus.collecting,
      coordinatorAgentId,
      leaseOwner,
      leaseUntil: new Date(Date.now() + COLLECTING_LEASE_SECONDS * 1000),
      selectedAgentIds: normalizeSelectedAgents(input.selectedAgentIds),
      strategy: input.strategy,
      attitude: input.attitude,
    },
  })
  if (result.count !== 1) throw new Error('ERR_REPLY_TASK_LEASED')
  return getReplyTask(task.id, input.ownerUserId)
}

export async function renewReplyTaskLease(input: {
  taskId: string
  ownerUserId: string
  coordinatorAgentId: string
  leaseOwner?: string
  leaseSeconds?: number
}) {
  const coordinatorAgentId = normalizeAgentId(input.coordinatorAgentId)
  const leaseOwner = normalizeAgentId(input.leaseOwner ?? coordinatorAgentId)
  const leaseSeconds = Math.min(
    Math.max(input.leaseSeconds ?? COLLECTING_LEASE_SECONDS, 60),
    MAX_LEASE_SECONDS,
  )
  const leaseUntil = new Date(Date.now() + leaseSeconds * 1000)
  const result = await prisma.agentReplyTask.updateMany({
    where: {
      ...activeTaskWhere(input.ownerUserId, input.taskId),
      coordinatorAgentId,
      leaseOwner,
    },
    data: { leaseUntil },
  })
  if (result.count !== 1) throw new Error('ERR_REPLY_TASK_LEASED')
  return { taskId: input.taskId, leaseUntil }
}

export async function contributeToReplyTask(input: {
  taskId: string
  ownerUserId: string
  agentId: string
  content: string
  recommendation?: string
  aiAttribution: AiAttributionInput
  idempotencyKey: string
  inputTokens?: number
  outputTokens?: number
}) {
  const agentId = normalizeAgentId(input.agentId)
  const content = input.content.trim()
  const idempotencyKey = input.idempotencyKey.trim()
  if (
    !content
    || content.length > MAX_CONTRIBUTION_LENGTH
    || idempotencyKey.length < 8
    || idempotencyKey.length > 160
  ) {
    throw new Error('ERR_REPLY_CONTRIBUTION_INVALID')
  }
  const task = await prisma.agentReplyTask.findFirst({
    where: {
      id: input.taskId,
      ownerUserId: input.ownerUserId,
      status: AgentReplyTaskStatus.collecting,
      leaseUntil: { gt: new Date() },
    },
    select: { id: true, selectedAgentIds: true },
  })
  if (!task) throw new Error('ERR_REPLY_TASK_NOT_ACTIONABLE')
  const selectedAgentIds = Array.isArray(task.selectedAgentIds)
    ? task.selectedAgentIds.filter((value): value is string => typeof value === 'string')
    : []
  if (!selectedAgentIds.includes(agentId)) {
    throw new Error('ERR_REPLY_AGENT_NOT_SELECTED')
  }
  const attribution = normalizeAiAttribution(input.aiAttribution)

  return prisma.agentReplyContribution.upsert({
    where: {
      taskId_idempotencyKey: {
        taskId: task.id,
        idempotencyKey,
      },
    },
    update: {},
    create: {
      taskId: task.id,
      agentId,
      content,
      recommendation: input.recommendation?.trim() || undefined,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      idempotencyKey,
      ...attribution,
      aiProvider: attribution.aiProvider!,
      aiModel: attribution.aiModel!,
      aiModelVersion: attribution.aiModelVersion!,
      aiGeneratedAt: attribution.aiGeneratedAt!,
    },
  })
}

export async function finalizeReplyTask(input: {
  taskId: string
  ownerUserId: string
  coordinatorAgentId: string
  leaseOwner?: string
  replyAgentId?: string
  content: string
  aiAttribution: AiAttributionInput
}) {
  const coordinatorAgentId = normalizeAgentId(input.coordinatorAgentId)
  const leaseOwner = normalizeAgentId(input.leaseOwner ?? coordinatorAgentId)
  const replyAgentId = normalizeAgentId(input.replyAgentId ?? coordinatorAgentId)
  const content = input.content.trim()
  if (!content || content.length > MAX_REPLY_LENGTH) {
    throw new Error('ERR_REPLY_CONTENT_INVALID')
  }
  if (!assessGeneratedReply(content).safe) {
    throw new Error('ERR_REPLY_OUTPUT_UNSAFE')
  }
  const attribution = normalizeAiAttribution(input.aiAttribution)

  return prisma.$transaction(async (tx) => {
    const task = await tx.agentReplyTask.findFirst({
      where: { id: input.taskId, ownerUserId: input.ownerUserId },
      include: {
        reviewComment: { select: { id: true, reviewId: true } },
        articleComment: { select: { id: true, articleId: true } },
      },
    })
    if (!task) throw new Error('ERR_REPLY_TASK_NOT_FOUND')
    if (task.status === AgentReplyTaskStatus.replied) {
      return {
        taskId: task.id,
        commentId: task.replyCommentId ?? task.replyArticleCommentId,
        created: false,
      }
    }
    if (
      task.status !== AgentReplyTaskStatus.claimed
      && task.status !== AgentReplyTaskStatus.collecting
    ) {
      throw new Error('ERR_REPLY_TASK_NOT_ACTIONABLE')
    }
    if (task.coordinatorAgentId && task.coordinatorAgentId !== coordinatorAgentId) {
      throw new Error('ERR_REPLY_TASK_LEASED')
    }
    if (task.leaseOwner && task.leaseOwner !== leaseOwner) {
      throw new Error('ERR_REPLY_TASK_LEASED')
    }
    if (!task.leaseUntil || task.leaseUntil <= new Date()) {
      throw new Error('ERR_REPLY_TASK_LEASED')
    }

    const selectedAgentIds = Array.isArray(task.selectedAgentIds)
      ? task.selectedAgentIds.filter((value): value is string => typeof value === 'string')
      : []
    if (
      selectedAgentIds.length > 0
      && !selectedAgentIds.includes(replyAgentId)
      && replyAgentId !== coordinatorAgentId
    ) {
      throw new Error('ERR_REPLY_AGENT_NOT_SELECTED')
    }

    const claimed = await tx.agentReplyTask.updateMany({
      where: {
        ...activeTaskWhere(input.ownerUserId, task.id),
        coordinatorAgentId: task.coordinatorAgentId,
        leaseOwner: task.leaseOwner,
      },
      data: {
        status: AgentReplyTaskStatus.replied,
        coordinatorAgentId,
        leaseOwner: null,
        leaseUntil: null,
        completedAt: new Date(),
        lastError: null,
      },
    })
    if (claimed.count !== 1) throw new Error('ERR_REPLY_TASK_NOT_ACTIONABLE')

    const commentData = {
      userId: input.ownerUserId,
      content,
      language: 'zh',
      status: CommentStatus.published,
      parentId: task.reviewComment?.id ?? task.articleComment?.id,
      threadRootId: task.threadKey,
      aiAgentId: replyAgentId,
      ...attribution,
    }
    let commentId: string
    if (task.reviewComment) {
      const comment = await tx.comment.create({
        data: {
          ...commentData,
          reviewId: task.reviewComment.reviewId,
        },
        select: { id: true },
      })
      commentId = comment.id
      await tx.agentReplyTask.update({
        where: { id: task.id },
        data: { replyCommentId: comment.id },
      })
    } else if (task.articleComment) {
      const comment = await tx.articleComment.create({
        data: {
          ...commentData,
          articleId: task.articleComment.articleId,
        },
        select: { id: true },
      })
      commentId = comment.id
      await tx.agentReplyTask.update({
        where: { id: task.id },
        data: { replyArticleCommentId: comment.id },
      })
    } else {
      throw new Error('ERR_REPLY_TASK_SOURCE_INVALID')
    }

    await tx.agentReplyContribution.updateMany({
      where: { taskId: task.id, agentId: replyAgentId },
      data: { selected: true },
    })
    return { taskId: task.id, commentId, created: true }
  })
}

export async function ignoreReplyTask(input: {
  taskId: string
  ownerUserId: string
  coordinatorAgentId: string
  leaseOwner?: string
  reason: string
}) {
  const coordinatorAgentId = normalizeAgentId(input.coordinatorAgentId)
  const leaseOwner = normalizeAgentId(input.leaseOwner ?? coordinatorAgentId)
  const reason = input.reason.trim().slice(0, 240)
  if (!reason) throw new Error('ERR_REPLY_IGNORE_REASON_REQUIRED')

  const result = await prisma.agentReplyTask.updateMany({
    where: {
      ...activeTaskWhere(input.ownerUserId, input.taskId),
      AND: [
        {
          OR: [
            { coordinatorAgentId: null },
            { coordinatorAgentId },
          ],
        },
        {
          OR: [
            { leaseOwner: null },
            { leaseOwner },
          ],
        },
      ],
    },
    data: {
      status: AgentReplyTaskStatus.ignored,
      coordinatorAgentId,
      leaseOwner: null,
      leaseUntil: null,
      lastError: reason,
      completedAt: new Date(),
    },
  })
  if (result.count !== 1) throw new Error('ERR_REPLY_TASK_NOT_ACTIONABLE')
  return { taskId: input.taskId, ignored: true }
}

export async function recordReplyTaskFailure(input: {
  taskId: string
  ownerUserId: string
  coordinatorAgentId: string
  leaseOwner?: string
  error: unknown
}) {
  const coordinatorAgentId = normalizeAgentId(input.coordinatorAgentId)
  const leaseOwner = normalizeAgentId(input.leaseOwner ?? coordinatorAgentId)
  const message = input.error instanceof Error
    && /^ERR_[A-Z0-9_]+$/.test(input.error.message)
    ? input.error.message
    : 'ERR_REPLY_WORKER_FAILED'
  const task = await prisma.agentReplyTask.findFirst({
    where: {
      ...activeTaskWhere(input.ownerUserId, input.taskId),
      coordinatorAgentId,
      leaseOwner,
    },
    select: { id: true, attempts: true },
  })
  if (!task) return
  const shouldRetry = RETRYABLE_FAILURES.has(message)
    && task.attempts < MAX_FAILURE_ATTEMPTS
  const retryDelayMs = Math.min(2 ** Math.max(task.attempts - 1, 0) * 60_000, 30 * 60_000)
  await prisma.agentReplyTask.updateMany({
    where: {
      ...activeTaskWhere(input.ownerUserId, task.id),
      coordinatorAgentId,
      leaseOwner,
      attempts: task.attempts,
    },
    data: {
      status: shouldRetry
        ? AgentReplyTaskStatus.pending
        : AgentReplyTaskStatus.failed,
      leaseOwner: null,
      leaseUntil: null,
      nextAttemptAt: shouldRetry
        ? new Date(Date.now() + retryDelayMs)
        : null,
      lastError: message.slice(0, 240),
    },
  })
}

export type ReplyTaskWithContext = Prisma.PromiseReturnType<typeof getReplyTask>
