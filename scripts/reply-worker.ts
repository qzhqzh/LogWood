import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import { AgentReplyStrategy } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import {
  claimReplyTasks,
  contributeToReplyTask,
  finalizeReplyTask,
  getReplyTask,
  ignoreReplyTask,
  planReplyTask,
  recordReplyTaskFailure,
} from '../src/modules/agent-reply'
import {
  TotemoraClient,
  toAiAttribution,
  type TotemoraMemberReply,
} from '../src/modules/agent-reply/totemora-client'
import {
  councilSynthesisPrompt,
  responsePrompt,
} from '../src/modules/agent-reply/prompts'
import { boundedWorkerInteger } from '../src/modules/agent-reply/worker-config'

const COORDINATOR_AGENT_ID = 'totemora-coordinator'
const DEFAULT_QWEN_MEMBER = 'qwen_worker'
const DEFAULT_DEEPSEEK_MEMBER = 'deepseek_reasoner'
const WORKER_LEASE_OWNER = process.env.LOGWOOD_REPLY_WORKER_ID?.trim().toLowerCase()
  || `${COORDINATOR_AGENT_ID}:${createHash('sha256')
    .update(`${hostname()}:${process.pid}:${Date.now()}`)
    .digest('hex')
    .slice(0, 16)}`

interface WorkerOptions {
  batchSize?: number
  client?: TotemoraClient
}

function boundedReply(content: string): string {
  const normalized = content
    .trim()
    .replace(/^```(?:markdown|text)?\s*/i, '')
    .replace(/\s*```$/, '')
  if (normalized.length <= 500) return normalized
  return `${normalized.slice(0, 497)}...`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function publicCommentForTask(
  task: Awaited<ReturnType<typeof getReplyTask>>,
): string {
  const content = task.reviewComment?.content ?? task.articleComment?.content
  if (!content) throw new Error('ERR_REPLY_TASK_SOURCE_INVALID')
  return content
}

function sourceContextForTask(
  task: Awaited<ReturnType<typeof getReplyTask>>,
): string {
  if (task.reviewComment?.review.content) {
    return task.reviewComment.review.content.slice(0, 1200)
  }
  if (task.articleComment?.article) {
    return [
      `文章标题：${task.articleComment.article.title}`,
      task.articleComment.article.excerpt
        ? `摘要：${task.articleComment.article.excerpt}`
        : '',
    ].filter(Boolean).join('\n').slice(0, 1200)
  }
  return ''
}

async function saveContribution(input: {
  ownerUserId: string
  taskId: string
  agentId: string
  reply: TotemoraMemberReply
  role: string
}) {
  return contributeToReplyTask({
    taskId: input.taskId,
    ownerUserId: input.ownerUserId,
    agentId: input.agentId,
    content: input.reply.content,
    aiAttribution: toAiAttribution(input.reply),
    idempotencyKey: `${input.taskId}:${input.agentId}:${input.role}`,
  })
}

async function processClaimedTask(input: {
  taskId: string
  ownerUserId: string
  client: TotemoraClient
}) {
  const task = await getReplyTask(input.taskId, input.ownerUserId)
  const content = publicCommentForTask(task)
  const sourceContext = sourceContextForTask(task)
  const configuredAgents = Array.isArray(task.selectedAgentIds)
    ? task.selectedAgentIds.filter((value): value is string => typeof value === 'string')
    : []

  if (
    task.strategy === AgentReplyStrategy.ignore
    || task.strategy === AgentReplyStrategy.escalate
  ) {
    return ignoreReplyTask({
      taskId: task.id,
      ownerUserId: input.ownerUserId,
      coordinatorAgentId: COORDINATOR_AGENT_ID,
      leaseOwner: WORKER_LEASE_OWNER,
      reason: task.strategy === AgentReplyStrategy.ignore
        ? 'POLICY_IGNORE'
        : 'POLICY_ESCALATE',
    })
  }

  const selectedAgentIds = configuredAgents.length > 0
    ? configuredAgents
    : [DEFAULT_QWEN_MEMBER]
  await planReplyTask({
    taskId: task.id,
    ownerUserId: input.ownerUserId,
    coordinatorAgentId: COORDINATOR_AGENT_ID,
    leaseOwner: WORKER_LEASE_OWNER,
    selectedAgentIds,
    strategy: task.strategy,
    attitude: task.attitude,
  })

  if (task.strategy === AgentReplyStrategy.council) {
    const councilIds = Array.from(new Set([
      ...selectedAgentIds,
      DEFAULT_QWEN_MEMBER,
      DEFAULT_DEEPSEEK_MEMBER,
    ])).slice(0, 5)
    const settled = await Promise.allSettled(councilIds.map(async (agentId) => {
      const reply = await input.client.chat(
        agentId,
        responsePrompt(content, task.strategy, 'candidate', sourceContext),
      )
      await saveContribution({
        ownerUserId: input.ownerUserId,
        taskId: task.id,
        agentId,
        reply,
        role: 'candidate',
      })
      return { agentId, reply }
    }))
    const candidates = settled.flatMap((result) => result.status === 'fulfilled'
      ? [{ agentId: result.value.agentId, content: result.value.reply.content }]
      : [])
    if (candidates.length === 0) throw new Error('ERR_REPLY_COUNCIL_FAILED')

    const synthesis = await input.client.chat(
      DEFAULT_DEEPSEEK_MEMBER,
      councilSynthesisPrompt(content, candidates, sourceContext),
    )
    await saveContribution({
      ownerUserId: input.ownerUserId,
      taskId: task.id,
      agentId: DEFAULT_DEEPSEEK_MEMBER,
      reply: synthesis,
      role: 'synthesis',
    })
    return finalizeReplyTask({
      taskId: task.id,
      ownerUserId: input.ownerUserId,
      coordinatorAgentId: COORDINATOR_AGENT_ID,
      leaseOwner: WORKER_LEASE_OWNER,
      replyAgentId: DEFAULT_DEEPSEEK_MEMBER,
      content: boundedReply(synthesis.content),
      aiAttribution: toAiAttribution(synthesis),
    })
  }

  const agentId = task.strategy === AgentReplyStrategy.sharp
    ? DEFAULT_DEEPSEEK_MEMBER
    : selectedAgentIds[0]!
  const reply = await input.client.chat(
    agentId,
    responsePrompt(content, task.strategy, 'final', sourceContext),
  )
  await saveContribution({
    ownerUserId: input.ownerUserId,
    taskId: task.id,
    agentId,
    reply,
    role: 'final',
  })
  return finalizeReplyTask({
    taskId: task.id,
    ownerUserId: input.ownerUserId,
    coordinatorAgentId: COORDINATOR_AGENT_ID,
    leaseOwner: WORKER_LEASE_OWNER,
    replyAgentId: agentId,
    content: boundedReply(reply.content),
    aiAttribution: toAiAttribution(reply),
  })
}

export async function runReplyWorkerOnce(options: WorkerOptions = {}) {
  const ownerEmail = process.env.LOGWOOD_MCP_USER_EMAIL?.trim().toLowerCase()
  if (!ownerEmail) throw new Error('ERR_MCP_USER_EMAIL_REQUIRED')
  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  })
  if (!owner) throw new Error('ERR_MCP_USER_NOT_FOUND')

  const tasks = await claimReplyTasks({
    ownerUserId: owner.id,
    coordinatorAgentId: COORDINATOR_AGENT_ID,
    leaseOwner: WORKER_LEASE_OWNER,
    limit: boundedWorkerInteger(
      options.batchSize ?? process.env.LOGWOOD_REPLY_BATCH_SIZE,
      { fallback: 3, min: 1, max: 10 },
    ),
    leaseSeconds: 600,
  })
  if (tasks.length === 0) return { claimed: 0, results: [] }
  let client: TotemoraClient
  try {
    client = options.client ?? new TotemoraClient({
      baseUrl: process.env.TOTEMORA_GATEWAY_URL || 'http://127.0.0.1:4310',
      operatorToken: process.env.TOTEMORA_OPERATOR_TOKEN || '',
    })
  } catch (error) {
    await Promise.all(tasks.map((task) => recordReplyTaskFailure({
      taskId: task.id,
      ownerUserId: owner.id,
      coordinatorAgentId: COORDINATOR_AGENT_ID,
      leaseOwner: WORKER_LEASE_OWNER,
      error,
    })))
    return {
      claimed: tasks.length,
      results: tasks.map((task) => ({
        taskId: task.id,
        error: error instanceof Error ? error.message : 'ERR_REPLY_WORKER_FAILED',
      })),
    }
  }
  const results = []
  for (const task of tasks) {
    try {
      results.push(await processClaimedTask({
        taskId: task.id,
        ownerUserId: owner.id,
        client,
      }))
    } catch (error) {
      await recordReplyTaskFailure({
        taskId: task.id,
        ownerUserId: owner.id,
        coordinatorAgentId: COORDINATOR_AGENT_ID,
        leaseOwner: WORKER_LEASE_OWNER,
        error,
      })
      results.push({
        taskId: task.id,
        error: error instanceof Error ? error.message : 'ERR_REPLY_WORKER_FAILED',
      })
    }
  }
  return { claimed: tasks.length, results }
}

async function main() {
  const once = process.argv.includes('--once')
  const pollMs = boundedWorkerInteger(process.env.LOGWOOD_REPLY_POLL_MS, {
    fallback: 60_000,
    min: 10_000,
    max: 3_600_000,
  })
  do {
    const result = await runReplyWorkerOnce()
    console.log(JSON.stringify({
      at: new Date().toISOString(),
      ...result,
    }))
    if (!once) await sleep(pollMs)
  } while (!once)
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'ERR_REPLY_WORKER_FAILED')
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
