import { afterEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  agentReplyTask: { groupBy: vi.fn(), findMany: vi.fn() },
  forgeDraftRequest: { groupBy: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { getAiCapabilities, getAiRuntimeStatus } from './service'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.clearAllMocks()
})

describe('ai-runtime/service', () => {
  it('discovers request, queue and protocol capabilities from configuration', () => {
    process.env.DEEPSEEK_API_KEY = 'configured'
    process.env.TOTEMORA_GATEWAY_URL = 'https://gateway.example.test'
    process.env.TOTEMORA_OPERATOR_TOKEN = 'configured'
    process.env.LOGWOOD_MCP_API_KEY = 'a'.repeat(40)
    process.env.LOGWOOD_MCP_USER_EMAIL = 'owner@example.com'

    expect(getAiCapabilities()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'forge-draft', configured: true, humanGate: true }),
      expect.objectContaining({ id: 'agent-reply', configured: true, mode: 'queue' }),
      expect.objectContaining({ id: 'mcp', configured: true, mode: 'protocol' }),
    ]))
  })

  it('does not advertise a malformed MCP credential map as configured', () => {
    delete process.env.LOGWOOD_MCP_API_KEY
    delete process.env.LOGWOOD_MCP_USER_EMAIL
    process.env.LOGWOOD_MCP_CREDENTIALS_JSON = '[{"tokenSha256":"bad"}]'

    expect(getAiCapabilities().find((item) => item.id === 'mcp')?.configured).toBe(false)
  })

  it('reports queue counts and bounded failure details for one owner', async () => {
    prismaMock.agentReplyTask.groupBy.mockResolvedValue([
      { status: 'failed', _count: { _all: 2 } },
    ])
    prismaMock.agentReplyTask.findMany.mockResolvedValue([{ id: 'task-1' }])
    prismaMock.forgeDraftRequest.groupBy.mockResolvedValue([
      { status: 'completed', _count: { _all: 3 } },
    ])
    prismaMock.forgeDraftRequest.findMany.mockResolvedValue([])

    const status = await getAiRuntimeStatus('owner-1')

    expect(status.replyQueue.counts).toEqual({ failed: 2 })
    expect(status.forge.counts).toEqual({ completed: 3 })
    expect(prismaMock.agentReplyTask.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerUserId: 'owner-1', status: 'failed' },
      take: 5,
    }))
  })
})
