import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: {
    upsert: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  authenticateMcpRequest,
  verifyMcpBearerToken,
} from './auth'

describe('mcp/auth', () => {
  const originalApiKey = process.env.LOGWOOD_MCP_API_KEY
  const originalUserEmail = process.env.LOGWOOD_MCP_USER_EMAIL
  const apiKey = 'a'.repeat(40)

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LOGWOOD_MCP_API_KEY = apiKey
    process.env.LOGWOOD_MCP_USER_EMAIL = 'owner@example.com'
  })

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.LOGWOOD_MCP_API_KEY
    else process.env.LOGWOOD_MCP_API_KEY = originalApiKey
    if (originalUserEmail === undefined) delete process.env.LOGWOOD_MCP_USER_EMAIL
    else process.env.LOGWOOD_MCP_USER_EMAIL = originalUserEmail
  })

  it('requires a strong configured key', () => {
    expect(() => verifyMcpBearerToken('Bearer weak', 'weak')).toThrow(
      expect.objectContaining({
        code: 'ERR_MCP_NOT_CONFIGURED',
        status: 503,
      }),
    )
  })

  it('uses an exact bearer token match', () => {
    expect(verifyMcpBearerToken(`Bearer ${apiKey}`)).toBe(true)
    expect(verifyMcpBearerToken('Bearer wrong-token')).toBe(false)
    expect(verifyMcpBearerToken(null)).toBe(false)
  })

  it('binds authenticated MCP calls to the configured user', async () => {
    prismaMock.user.upsert.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
    })

    const user = await authenticateMcpRequest(new Request('http://localhost/api/mcp', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-LogWood-Agent-Id': 'DeepSeek_Reasoner',
      },
    }))

    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { email: 'owner@example.com' },
      update: {},
      create: {
        email: 'owner@example.com',
        name: 'LogWood MCP',
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })
    expect(user.id).toBe('user-1')
    expect(user.agentId).toBe('deepseek_reasoner')
  })
})
