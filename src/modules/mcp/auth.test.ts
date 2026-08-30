import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

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
  const originalAgentId = process.env.LOGWOOD_MCP_AGENT_ID
  const originalCredentials = process.env.LOGWOOD_MCP_CREDENTIALS_JSON
  const apiKey = 'a'.repeat(40)

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LOGWOOD_MCP_API_KEY = apiKey
    process.env.LOGWOOD_MCP_USER_EMAIL = 'owner@example.com'
    process.env.LOGWOOD_MCP_AGENT_ID = 'codex'
    delete process.env.LOGWOOD_MCP_CREDENTIALS_JSON
  })

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.LOGWOOD_MCP_API_KEY
    else process.env.LOGWOOD_MCP_API_KEY = originalApiKey
    if (originalUserEmail === undefined) delete process.env.LOGWOOD_MCP_USER_EMAIL
    else process.env.LOGWOOD_MCP_USER_EMAIL = originalUserEmail
    if (originalAgentId === undefined) delete process.env.LOGWOOD_MCP_AGENT_ID
    else process.env.LOGWOOD_MCP_AGENT_ID = originalAgentId
    if (originalCredentials === undefined) delete process.env.LOGWOOD_MCP_CREDENTIALS_JSON
    else process.env.LOGWOOD_MCP_CREDENTIALS_JSON = originalCredentials
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

  it('binds a legacy token to the configured user and agent identity', async () => {
    prismaMock.user.upsert.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
    })

    const user = await authenticateMcpRequest(new Request('http://localhost/api/mcp', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-LogWood-Agent-Id': 'codex',
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
    expect(user.agentId).toBe('codex')
  })

  it('rejects a self-reported agent identity that differs from the credential', async () => {
    prismaMock.user.upsert.mockResolvedValue({
      id: 'user-1', email: 'owner@example.com', name: 'Owner',
    })

    await expect(authenticateMcpRequest(new Request('http://localhost/api/mcp', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-LogWood-Agent-Id': 'deepseek_reasoner',
      },
    }))).rejects.toMatchObject({ code: 'ERR_MCP_UNAUTHORIZED', status: 401 })
  })

  it('maps a hashed credential to its own user and agent identity', async () => {
    const mappedToken = 'mapped-secret-token-value'
    process.env.LOGWOOD_MCP_CREDENTIALS_JSON = JSON.stringify([{
      tokenSha256: createHash('sha256').update(mappedToken).digest('hex'),
      email: 'agent@example.com',
      agentId: 'deepseek_reasoner',
    }])
    prismaMock.user.upsert.mockResolvedValue({
      id: 'user-2', email: 'agent@example.com', name: 'LogWood MCP',
    })

    const user = await authenticateMcpRequest(new Request('http://localhost/api/mcp', {
      headers: { Authorization: `Bearer ${mappedToken}` },
    }))

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'agent@example.com' },
    }))
    expect(user).toMatchObject({ id: 'user-2', agentId: 'deepseek_reasoner' })
  })
})
