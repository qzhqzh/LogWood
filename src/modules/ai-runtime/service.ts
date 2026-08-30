import { AgentReplyTaskStatus, ForgeRequestStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface AiCapability {
  id: 'candidate-idea' | 'forge-draft' | 'agent-reply' | 'mcp'
  label: string
  configured: boolean
  mode: 'request' | 'queue' | 'protocol'
  provider: string
  model?: string
  humanGate: boolean
}

function hasCredentialMap() {
  const value = process.env.LOGWOOD_MCP_CREDENTIALS_JSON?.trim()
  if (!value) return false
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      && parsed.length > 0
      && parsed.length <= 50
      && parsed.every((item) => {
        if (!item || typeof item !== 'object') return false
        const credential = item as Record<string, unknown>
        return typeof credential.tokenSha256 === 'string'
          && /^[a-f0-9]{64}$/i.test(credential.tokenSha256.trim())
          && typeof credential.email === 'string'
          && credential.email.includes('@')
          && typeof credential.agentId === 'string'
          && /^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(credential.agentId.trim())
      })
  } catch {
    return false
  }
}

export function getAiCapabilities(): AiCapability[] {
  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY?.trim())
  return [
    {
      id: 'candidate-idea',
      label: '灵感保守提炼',
      configured: hasDeepSeek,
      mode: 'request',
      provider: 'DeepSeek',
      model: process.env.DEEPSEEK_IDEA_MODEL || 'deepseek-v4-pro',
      humanGate: true,
    },
    {
      id: 'forge-draft',
      label: '造物台协作草稿',
      configured: hasDeepSeek,
      mode: 'request',
      provider: 'DeepSeek',
      model: process.env.DEEPSEEK_FORGE_MODEL || 'deepseek-v4-pro',
      humanGate: true,
    },
    {
      id: 'agent-reply',
      label: '站内 Agent 回复队列',
      configured: Boolean(
        process.env.TOTEMORA_GATEWAY_URL?.trim()
        && process.env.TOTEMORA_OPERATOR_TOKEN?.trim(),
      ),
      mode: 'queue',
      provider: 'Totemora',
      humanGate: false,
    },
    {
      id: 'mcp',
      label: 'MCP 内容与回复协议',
      configured: hasCredentialMap() || Boolean(
        process.env.LOGWOOD_MCP_API_KEY?.trim()
        && process.env.LOGWOOD_MCP_USER_EMAIL?.trim(),
      ),
      mode: 'protocol',
      provider: 'LogWood MCP',
      humanGate: true,
    },
  ]
}

export async function getAiRuntimeStatus(ownerUserId?: string) {
  const taskWhere = ownerUserId ? { ownerUserId } : {}
  const [replyGroups, latestFailures, forgeGroups, recentForgeFailures] = await Promise.all([
    prisma.agentReplyTask.groupBy({
      by: ['status'],
      where: taskWhere,
      _count: { _all: true },
    }),
    prisma.agentReplyTask.findMany({
      where: { ...taskWhere, status: AgentReplyTaskStatus.failed },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, sourceType: true, attempts: true, lastError: true, updatedAt: true },
    }),
    prisma.forgeDraftRequest.groupBy({
      by: ['status'],
      where: ownerUserId ? { ownerUserId } : {},
      _count: { _all: true },
    }),
    prisma.forgeDraftRequest.findMany({
      where: {
        ...(ownerUserId ? { ownerUserId } : {}),
        status: ForgeRequestStatus.failed,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, kind: true, mode: true, attempts: true, errorCode: true, updatedAt: true },
    }),
  ])

  return {
    capabilities: getAiCapabilities(),
    replyQueue: {
      counts: Object.fromEntries(replyGroups.map((group) => [group.status, group._count._all])),
      latestFailures,
    },
    forge: {
      counts: Object.fromEntries(forgeGroups.map((group) => [group.status, group._count._all])),
      latestFailures: recentForgeFailures,
    },
    observedAt: new Date().toISOString(),
  }
}
