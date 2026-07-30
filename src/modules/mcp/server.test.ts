import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

const actionMocks = vi.hoisted(() => ({
  claimMcpReplyTasks: vi.fn(),
  contributeMcpReplyTask: vi.fn(),
  createMcpArticle: vi.fn(),
  createMcpReview: vi.fn(),
  finalizeMcpReplyTask: vi.fn(),
  getMcpReplyInboxStatus: vi.fn(),
  getMcpReplyTask: vi.fn(),
  ignoreMcpReplyTask: vi.fn(),
  listMcpInspirations: vi.fn(),
  planMcpReplyTask: vi.fn(),
  promoteMcpInspirationToApp: vi.fn(),
  promoteMcpInspirationToSkill: vi.fn(),
  recordMcpInspiration: vi.fn(),
  updateMcpInspiration: vi.fn(),
}))

vi.mock('@/modules/mcp/actions', () => actionMocks)

import { createLogWoodMcpServer } from './server'

const closers: Array<() => Promise<void>> = []

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(closers.splice(0).map((close) => close()))
})

async function connectClient() {
  const server = createLogWoodMcpServer('mcp-user-1')
  const client = new Client({
    name: 'logwood-test-client',
    version: '1.0.0',
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  closers.push(() => client.close(), () => server.close())
  return client
}

describe('mcp/server', () => {
  it('advertises the complete LogWood tool surface through MCP', async () => {
    const client = await connectClient()
    const result = await client.listTools()

    expect(result.tools.map((tool) => tool.name)).toEqual([
      'logwood_inspiration_record',
      'logwood_inspiration_list',
      'logwood_inspiration_update',
      'logwood_inspiration_to_skill',
      'logwood_inspiration_to_app',
      'logwood_review_publish',
      'logwood_article_publish',
      'logwood_reply_inbox_status',
      'logwood_reply_inbox_claim',
      'logwood_reply_task_get',
      'logwood_reply_plan',
      'logwood_reply_contribute',
      'logwood_reply_renew',
      'logwood_reply_finalize',
      'logwood_reply_ignore',
    ])
    expect(result.tools.find(
      (tool) => tool.name === 'logwood_review_publish',
    )?.inputSchema.required).toContain('aiAttribution')
  })

  it('uses the authenticated agent identity for reply contributions', async () => {
    actionMocks.contributeMcpReplyTask.mockResolvedValue({ id: 'contribution-1' })
    const server = createLogWoodMcpServer('mcp-user-1', 'deepseek_reasoner')
    const client = new Client({
      name: 'logwood-agent-test-client',
      version: '1.0.0',
    })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)
    closers.push(() => client.close(), () => server.close())

    const result = await client.callTool({
      name: 'logwood_reply_contribute',
      arguments: {
        taskId: 'task-1',
        content: '这个论证忽略了数据库写入放大的成本。',
        idempotencyKey: 'task-1-deepseek-candidate',
        aiAttribution: {
          provider: 'deepseek',
          model: 'deepseek-v4-pro',
          modelVersion: '2026-07',
        },
      },
    })

    expect(result.isError).not.toBe(true)
    expect(actionMocks.contributeMcpReplyTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1' }),
      'mcp-user-1',
      'deepseek_reasoner',
    )
  })

  it('validates and forwards an inspiration record to the bound MCP user', async () => {
    actionMocks.recordMcpInspiration.mockResolvedValue({
      created: true,
      candidate: { id: 'candidate-1', title: '移动端截图归档' },
    })
    const client = await connectClient()

    const result = await client.callTool({
      name: 'logwood_inspiration_record',
      arguments: {
        content: '移动端截图归档',
        idempotencyKey: 'capture-mobile-inspiration',
      },
    })
    expect(actionMocks.recordMcpInspiration).toHaveBeenCalledWith({
      content: '移动端截图归档',
      idempotencyKey: 'capture-mobile-inspiration',
    }, 'mcp-user-1')
    expect(result.isError).not.toBe(true)
  })

  it('returns a stable error code without exposing internal failures', async () => {
    actionMocks.listMcpInspirations.mockRejectedValue(new Error('database details'))
    const client = await connectClient()

    const result = await client.callTool({
      name: 'logwood_inspiration_list',
      arguments: {},
    })
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{
      type: 'text',
      text: '{"error":"ERR_MCP_TOOL_FAILED"}',
    }])
  })

  it('parses AI generation time before forwarding a review', async () => {
    actionMocks.createMcpReview.mockResolvedValue({
      id: 'review-1',
      status: 'published',
    })
    const client = await connectClient()

    const result = await client.callTool({
      name: 'logwood_review_publish',
      arguments: {
        subjectType: 'skill',
        subjectSlug: 'release-workflow',
        rating: 4,
        content: '流程清晰，但还需要失败回滚示例。',
        aiAttribution: {
          provider: 'OpenAI',
          model: 'gpt-5.4',
          modelVersion: '2026-06-01',
          generatedAt: '2026-07-29T12:00:00Z',
        },
      },
    })

    expect(result.isError).not.toBe(true)
    expect(actionMocks.createMcpReview).toHaveBeenCalledWith(
      expect.objectContaining({
        aiAttribution: expect.objectContaining({
          generatedAt: new Date('2026-07-29T12:00:00Z'),
        }),
      }),
      'mcp-user-1',
    )
  })
})
