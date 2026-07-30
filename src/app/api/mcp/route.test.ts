import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authenticateMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/mcp/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/mcp/auth')>()
  return {
    ...actual,
    authenticateMcpRequest: authenticateMock,
  }
})

import { DELETE, GET, POST } from './route'

function mcpRequest(body: unknown) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/mcp', () => {
  beforeEach(() => {
    authenticateMock.mockReset()
    authenticateMock.mockResolvedValue({
      id: 'mcp-user-1',
      email: 'agent@example.com',
      name: 'LogWood MCP',
      agentId: 'codex',
    })
  })

  it('handles an MCP initialization request over Streamable HTTP', async () => {
    const response = await POST(mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'route-test',
          version: '1.0.0',
        },
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: {
          name: 'logwood',
          version: '0.1.0',
        },
      },
    })
  })

  it('supports a complete stateless HTTP client initialization and tool listing', async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost/api/mcp'),
      {
        requestInit: {
          headers: { authorization: 'Bearer test-token' },
        },
        fetch: async (input, init) => {
          const request = new Request(input, init)
          if (request.method === 'POST') return POST(request)
          if (request.method === 'DELETE') return DELETE()
          return GET()
        },
      },
    )
    const client = new Client({
      name: 'route-test-client',
      version: '1.0.0',
    })

    try {
      await client.connect(transport)
      const result = await client.listTools()
      expect(result.tools).toHaveLength(14)
      expect(result.tools.map((tool) => tool.name)).toContain(
        'logwood_inspiration_record',
      )
      expect(result.tools.map((tool) => tool.name)).toContain(
        'logwood_reply_finalize',
      )
    } finally {
      await client.close()
    }
  })

  it('rejects a request before protocol handling when authentication fails', async () => {
    const { McpAuthError } = await import('@/modules/mcp/auth')
    authenticateMock.mockRejectedValue(
      new McpAuthError('ERR_MCP_UNAUTHORIZED', 401),
    )

    const response = await POST(mcpRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }))

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('Bearer')
    expect(await response.json()).toMatchObject({
      error: { message: 'ERR_MCP_UNAUTHORIZED' },
    })
  })
})
