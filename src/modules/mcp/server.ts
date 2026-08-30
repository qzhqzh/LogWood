import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  claimMcpReplyTasks,
  contributeMcpReplyTask,
  createMcpArticle,
  createMcpReview,
  finalizeMcpReplyTask,
  getMcpCapabilities,
  getMcpReplyInboxStatus,
  getMcpReplyTask,
  ignoreMcpReplyTask,
  listMcpInspirations,
  planMcpReplyTask,
  promoteMcpInspirationToApp,
  promoteMcpInspirationToSkill,
  recordMcpInspiration,
  renewMcpReplyTask,
  updateMcpInspiration,
} from '@/modules/mcp/actions'
import {
  inspirationToAppSchema,
  inspirationToSkillSchema,
  listInspirationsSchema,
  publishArticleSchema,
  publishReviewShape,
  recordInspirationSchema,
  replyContributeSchema,
  replyFinalizeSchema,
  replyIgnoreSchema,
  replyInboxClaimSchema,
  replyTaskGetSchema,
  replyTaskPlanSchema,
  replyTaskRenewSchema,
  updateInspirationShape,
} from '@/modules/mcp/schemas'

function success(value: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(value, null, 2),
    }],
  }
}

function failure(error: unknown) {
  const message = error instanceof Error && /^ERR_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : 'ERR_MCP_TOOL_FAILED'
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: message }),
    }],
  }
}

async function runTool<T>(operation: () => Promise<T>) {
  try {
    return success(await operation())
  } catch (error) {
    return failure(error)
  }
}

export function createLogWoodMcpServer(
  authorUserId: string,
  authenticatedAgentId = 'codex',
) {
  const server = new McpServer({
    name: 'logwood',
    version: '0.1.0',
  })

  server.registerTool('logwood_capabilities_get', {
    title: '发现 LogWood 能力',
    description: '读取当前 AI/MCP 能力、人工门禁、归属与幂等策略；不会调用模型。',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, () => runTool(() => getMcpCapabilities(authorUserId)))

  server.registerTool('logwood_inspiration_record', {
    title: '记录灵感',
    description: '即时记录一条文本灵感，可附来源、图片、标签和幂等键。',
    inputSchema: recordInspirationSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => recordMcpInspiration(input, authorUserId)))

  server.registerTool('logwood_inspiration_list', {
    title: '查找灵感',
    description: '按关键词和处理状态查找当前 MCP 用户的灵感。',
    inputSchema: listInspirationsSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => listMcpInspirations(input, authorUserId)))

  server.registerTool('logwood_inspiration_update', {
    title: '整理灵感',
    description: '更新一条灵感的标签或状态。',
    inputSchema: updateInspirationShape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => updateMcpInspiration(input, authorUserId)))

  server.registerTool('logwood_inspiration_to_skill', {
    title: '沉淀为 Skill',
    description: '将一条灵感原子化地整理为可复用 Skill，并标记原灵感已处理。',
    inputSchema: inspirationToSkillSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  }, (input) => runTool(() => promoteMcpInspirationToSkill(input, authorUserId)))

  server.registerTool('logwood_inspiration_to_app', {
    title: '沉淀为 App',
    description: '将一条带预览图的灵感原子化地整理为 App，并标记原灵感已处理。',
    inputSchema: inspirationToAppSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  }, (input) => runTool(() => promoteMcpInspirationToApp(input, authorUserId)))

  server.registerTool('logwood_review_publish', {
    title: '发表吐槽',
    description: '为灵感、Skill、App 或目标发表 AI 生成的吐槽；必须记录模型归属。',
    inputSchema: publishReviewShape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  }, (input) => runTool(() => createMcpReview(input, authorUserId)))

  server.registerTool('logwood_article_publish', {
    title: '创建经验文章草稿',
    description: '兼容旧工具名：创建带完整模型归属的 AI 经验文章草稿；不能直接公开。',
    inputSchema: publishArticleSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  }, (input) => runTool(() => createMcpArticle(input, authorUserId)))

  server.registerTool('logwood_reply_inbox_status', {
    title: '查看回复收件箱',
    description: '零模型调用地查看待处理、已领取和失败的 AI 内容回复任务数量。',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, () => runTool(() => getMcpReplyInboxStatus(authorUserId)))

  server.registerTool('logwood_reply_inbox_claim', {
    title: '领取回复任务',
    description: '按优先级领取回复任务并返回 leaseToken；空收件箱不会触发任何模型。',
    inputSchema: replyInboxClaimSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  }, (input) => runTool(() => claimMcpReplyTasks(
    input,
    authorUserId,
    authenticatedAgentId,
  )))

  server.registerTool('logwood_reply_task_get', {
    title: '读取回复任务',
    description: '读取一条任务的公开评论上下文、策略和所有 Agent 候选意见。',
    inputSchema: replyTaskGetSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => getMcpReplyTask(input.taskId, authorUserId)))

  server.registerTool('logwood_reply_plan', {
    title: '安排回复成员',
    description: '由持有 leaseToken 的协调者指定 Agent 和回复策略。',
    inputSchema: replyTaskPlanSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => planMcpReplyTask(
    input,
    authorUserId,
    authenticatedAgentId,
  )))

  server.registerTool('logwood_reply_contribute', {
    title: '提交回复候选',
    description: '当前 Agent 为任务提交候选意见；不会直接公开发布。',
    inputSchema: replyContributeSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => contributeMcpReplyTask(
    input,
    authorUserId,
    authenticatedAgentId,
  )))

  server.registerTool('logwood_reply_renew', {
    title: '续期回复任务',
    description: '长时间生成或协调前，由持有 leaseToken 的协调者延长当前未过期租约。',
    inputSchema: replyTaskRenewSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => renewMcpReplyTask(
    input,
    authorUserId,
    authenticatedAgentId,
  )))

  server.registerTool('logwood_reply_finalize', {
    title: '发布协调回复',
    description: '持有 leaseToken 的协调者发布唯一安全回复，并记录 Agent 和模型归属。',
    inputSchema: replyFinalizeSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => finalizeMcpReplyTask(
    input,
    authorUserId,
    authenticatedAgentId,
  )))

  server.registerTool('logwood_reply_ignore', {
    title: '忽略回复任务',
    description: '将垃圾、危险或不值得继续的任务标记为忽略并记录原因。',
    inputSchema: replyIgnoreSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  }, (input) => runTool(() => ignoreMcpReplyTask(
    input,
    authorUserId,
    authenticatedAgentId,
  )))

  return server
}
