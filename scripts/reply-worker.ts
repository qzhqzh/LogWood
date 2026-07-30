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
  renewReplyTaskLease,
} from '../src/modules/agent-reply'
import { ensureMcpOwnerUser } from '../src/modules/mcp/auth'
import {
  TotemoraClient,
  toAiAttribution,
  type TotemoraMemberReply,
} from '../src/modules/agent-reply/totemora-client'
import {
  councilSynthesisPrompt,
  responsePrompt,
} from '../src/modules/agent-reply/prompts'
import { assessGeneratedReply } from '../src/modules/agent-reply/policy'
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

async function finalizeSafeReply(input: {
  ownerUserId: string
  taskId: string
  replyAgentId: string
  reply: TotemoraMemberReply
}) {
  await renewReplyTaskLease({
    taskId: input.taskId,
    ownerUserId: input.ownerUserId,
    coordinatorAgentId: COORDINATOR_AGENT_ID,
    leaseOwner: WORKER_LEASE_OWNER,
  })
  const content = boundedReply(input.reply.content)
  const assessment = assessGeneratedReply(content)
  if (!assessment.safe) {
    return ignoreReplyTask({
      taskId: input.taskId,
      ownerUserId: input.ownerUserId,
      coordinatorAgentId: COORDINATOR_AGENT_ID,
      leaseOwner: WORKER_LEASE_OWNER,
      reason: assessment.reason || 'MODEL_OUTPUT_UNSAFE',
    })
  }
  return finalizeReplyTask({
    taskId: input.taskId,
    ownerUserId: input.ownerUserId,
    coordinatorAgentId: COORDINATOR_AGENT_ID,
    leaseOwner: WORKER_LEASE_OWNER,
    replyAgentId: input.replyAgentId,
    content,
    aiAttribution: toAiAttribution(input.reply),
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
  const plannedAgentIds = task.strategy === AgentReplyStrategy.council
    ? Array.from(new Set([
        DEFAULT_QWEN_MEMBER,
        DEFAULT_DEEPSEEK_MEMBER,
        ...selectedAgentIds,
      ])).slice(0, 5)
    : selectedAgentIds
  await planReplyTask({
    taskId: task.id,
    ownerUserId: input.ownerUserId,
    coordinatorAgentId: COORDINATOR_AGENT_ID,
    leaseOwner: WORKER_LEASE_OWNER,
    selectedAgentIds: plannedAgentIds,
    strategy: task.strategy,
    attitude: task.attitude,
  })

  if (task.strategy === AgentReplyStrategy.council) {
    const settled = await Promise.allSettled(plannedAgentIds.map(async (agentId) => {
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

    await renewReplyTaskLease({
      taskId: task.id,
      ownerUserId: input.ownerUserId,
      coordinatorAgentId: COORDINATOR_AGENT_ID,
      leaseOwner: WORKER_LEASE_OWNER,
    })
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
    return finalizeSafeReply({
      taskId: task.id,
      ownerUserId: input.ownerUserId,
      replyAgentId: DEFAULT_DEEPSEEK_MEMBER,
      reply: synthesis,
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
  return finalizeSafeReply({
    taskId: task.id,
    ownerUserId: input.ownerUserId,
    replyAgentId: agentId,
    reply,
  })
}

export async function runReplyWorkerOnce(options: WorkerOptions = {}) {
  const owner = await ensureMcpOwnerUser()

  const batchSize = boundedWorkerInteger(
    options.batchSize ?? process.env.LOGWOOD_REPLY_BATCH_SIZE,
    { fallback: 3, min: 1, max: 10 },
  )
  let client = options.client
  let claimed = 0
  const results: unknown[] = []
  for (let index = 0; index < batchSize; index += 1) {
    const [task] = await claimReplyTasks({
      ownerUserId: owner.id,
      coordinatorAgentId: COORDINATOR_AGENT_ID,
      leaseOwner: WORKER_LEASE_OWNER,
      limit: 1,
      leaseSeconds: 600,
    })
    if (!task) break
    claimed += 1

    if (!client) {
      try {
        client = new TotemoraClient({
          baseUrl: process.env.TOTEMORA_GATEWAY_URL || 'http://127.0.0.1:4310',
          operatorToken: process.env.TOTEMORA_OPERATOR_TOKEN || '',
        })
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
        break
      }
    }

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
  return { claimed, results }
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
