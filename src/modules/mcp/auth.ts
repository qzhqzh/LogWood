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

interface McpCredential {
  tokenSha256: string
  email: string
  agentId: string
}

function normalizeAgentId(value: string) {
  const agentId = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(agentId)) {
    throw new McpAuthError('ERR_MCP_NOT_CONFIGURED', 503)
  }
  return agentId
}

function readCredentialMap(raw = process.env.LOGWOOD_MCP_CREDENTIALS_JSON): McpCredential[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 50) throw new Error()
    return parsed.map((item) => {
      if (!item || typeof item !== 'object') throw new Error()
      const value = item as Record<string, unknown>
      const tokenSha256 = typeof value.tokenSha256 === 'string'
        ? value.tokenSha256.trim().toLowerCase()
        : ''
      const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : ''
      const agentId = typeof value.agentId === 'string' ? normalizeAgentId(value.agentId) : ''
      if (!/^[a-f0-9]{64}$/.test(tokenSha256) || !email.includes('@') || !agentId) throw new Error()
      return { tokenSha256, email, agentId }
    })
  } catch {
    throw new McpAuthError('ERR_MCP_NOT_CONFIGURED', 503)
  }
}

function bearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1] || null
}

function matchCredential(token: string, credentials: McpCredential[]) {
  const actual = hashSecret(token)
  let matched: McpCredential | null = null
  for (const credential of credentials) {
    const expected = Buffer.from(credential.tokenSha256, 'hex')
    if (expected.length === actual.length && timingSafeEqual(actual, expected)) matched = credential
  }
  return matched
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

export async function ensureMcpOwnerUser(emailOverride?: string) {
  const email = emailOverride?.trim().toLowerCase()
    || process.env.LOGWOOD_MCP_USER_EMAIL?.trim().toLowerCase()
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
  const token = bearerToken(request.headers.get('authorization'))
  if (!token) throw new McpAuthError('ERR_MCP_UNAUTHORIZED', 401)
  const credentials = readCredentialMap()
  if (credentials.length > 0) {
    const credential = matchCredential(token, credentials)
    if (!credential) throw new McpAuthError('ERR_MCP_UNAUTHORIZED', 401)
    const user = await ensureMcpOwnerUser(credential.email)
    return { ...user, agentId: credential.agentId }
  }

  if (!verifyMcpBearerToken(request.headers.get('authorization'))) {
    throw new McpAuthError('ERR_MCP_UNAUTHORIZED', 401)
  }
  const user = await ensureMcpOwnerUser()
  const configuredAgentId = normalizeAgentId(process.env.LOGWOOD_MCP_AGENT_ID || 'codex')
  const requestedAgentId = request.headers.get('x-logwood-agent-id')?.trim().toLowerCase()
  if (requestedAgentId && requestedAgentId !== configuredAgentId) {
    throw new McpAuthError('ERR_MCP_UNAUTHORIZED', 401)
  }
  return {
    ...user,
    agentId: configuredAgentId,
  }
}
