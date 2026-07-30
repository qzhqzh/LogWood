import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  authenticateMcpRequest,
  McpAuthError,
} from '@/modules/mcp/auth'
import { createLogWoodMcpServer } from '@/modules/mcp/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonRpcError(status: number, code: number, message: string) {
  return Response.json({
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  }, {
    status,
    headers: status === 401
      ? { 'WWW-Authenticate': 'Bearer realm="LogWood MCP"' }
      : undefined,
  })
}

export async function POST(request: Request) {
  try {
    const principal = await authenticateMcpRequest(request)
    const server = createLogWoodMcpServer(principal.id, principal.agentId)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    try {
      await server.connect(transport)
      return await transport.handleRequest(request)
    } finally {
      await server.close()
    }
  } catch (error) {
    if (error instanceof McpAuthError) {
      return jsonRpcError(error.status, -32001, error.code)
    }
    return jsonRpcError(500, -32603, 'ERR_MCP_INTERNAL')
  }
}

export async function GET() {
  return jsonRpcError(405, -32000, 'Method not allowed')
}

export const DELETE = GET
