import { createHash, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export class McpAuthError extends Error {
  constructor(
    public readonly code: 'ERR_MCP_NOT_CONFIGURED' | 'ERR_MCP_UNAUTHORIZED',
    public readonly status: 401 | 503,
  ) {
    super(code)
  }
}

function hashSecret(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

export function verifyMcpBearerToken(
  authorizationHeader: string | null,
  configuredKey: string | undefined = process.env.LOGWOOD_MCP_API_KEY,
): boolean {
  if (!configuredKey || configuredKey.length < 32) {
    throw new McpAuthError('ERR_MCP_NOT_CONFIGURED', 503)
  }

  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return false

  return timingSafeEqual(hashSecret(match[1]), hashSecret(configuredKey))
}

export async function ensureMcpOwnerUser() {
  const email = process.env.LOGWOOD_MCP_USER_EMAIL?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new McpAuthError('ERR_MCP_NOT_CONFIGURED', 503)
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'LogWood MCP',
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })
  return user
}

export async function authenticateMcpRequest(request: Request) {
  if (!verifyMcpBearerToken(request.headers.get('authorization'))) {
    throw new McpAuthError('ERR_MCP_UNAUTHORIZED', 401)
  }

  const user = await ensureMcpOwnerUser()
  const requestedAgentId = request.headers.get('x-logwood-agent-id')
    ?.trim()
    .toLowerCase() || 'codex'
  if (!/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(requestedAgentId)) {
    throw new McpAuthError('ERR_MCP_UNAUTHORIZED', 401)
  }
  return {
    ...user,
    agentId: requestedAgentId,
  }
}
