export interface TotemoraMember {
  id: string
  name?: string
  provider: string
  model: string
  version?: string | number
  status?: string
}

export interface TotemoraMemberReply {
  content: string
  generatedAt: Date
  member: TotemoraMember
}

interface TotemoraClientOptions {
  baseUrl: string
  operatorToken: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  memberCacheMs?: number
}

export class TotemoraClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly memberCacheMs: number
  private memberCache?: { expiresAt: number; members: TotemoraMember[] }
  private memberRequest?: Promise<TotemoraMember[]>

  constructor(private readonly options: TotemoraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 180_000
    this.memberCacheMs = options.memberCacheMs ?? 30_000
    if (!options.operatorToken.trim()) {
      throw new Error('ERR_TOTEMORA_OPERATOR_TOKEN_REQUIRED')
    }
  }

  async listMembers(): Promise<TotemoraMember[]> {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/tribe`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw new Error('ERR_TOTEMORA_TRIBE_UNAVAILABLE')
    }
    if (!response.ok) throw new Error('ERR_TOTEMORA_TRIBE_UNAVAILABLE')
    try {
      const payload = await response.json() as {
        members?: TotemoraMember[]
        tribe?: { members?: TotemoraMember[] }
      }
      return payload.members ?? payload.tribe?.members ?? []
    } catch {
      throw new Error('ERR_TOTEMORA_TRIBE_UNAVAILABLE')
    }
  }

  private async getMembers(): Promise<TotemoraMember[]> {
    if (this.memberCache && this.memberCache.expiresAt > Date.now()) {
      return this.memberCache.members
    }
    if (this.memberRequest) return this.memberRequest

    this.memberRequest = this.listMembers()
      .then((members) => {
        this.memberCache = {
          members,
          expiresAt: Date.now() + this.memberCacheMs,
        }
        return members
      })
      .finally(() => {
        this.memberRequest = undefined
      })
    return this.memberRequest
  }

  async chat(memberId: string, message: string): Promise<TotemoraMemberReply> {
    const members = await this.getMembers()
    const member = members.find((item) => item.id === memberId)
    if (!member || ['inactive', 'retired'].includes(member.status ?? '')) {
      throw new Error('ERR_TOTEMORA_MEMBER_UNAVAILABLE')
    }

    let response: Response
    try {
      response = await this.fetchImpl(
        `${this.baseUrl}/api/members/${encodeURIComponent(memberId)}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.options.operatorToken}`,
          },
          body: JSON.stringify({
            message,
            ask_mentor: false,
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      )
    } catch {
      throw new Error('ERR_TOTEMORA_CHAT_FAILED')
    }
    if (!response.ok) throw new Error('ERR_TOTEMORA_CHAT_FAILED')
    let payload: { reply?: { content?: string; at?: string } }
    try {
      payload = await response.json() as typeof payload
    } catch {
      throw new Error('ERR_TOTEMORA_CHAT_FAILED')
    }
    const content = payload.reply?.content?.trim()
    if (!content) throw new Error('ERR_TOTEMORA_EMPTY_REPLY')
    const generatedAt = payload.reply?.at
      ? new Date(payload.reply.at)
      : new Date()
    return { content, generatedAt, member }
  }
}

export function toAiAttribution(reply: TotemoraMemberReply) {
  return {
    provider: reply.member.provider,
    model: reply.member.model,
    modelVersion: String(reply.member.version || reply.member.model),
    generatedAt: reply.generatedAt,
  }
}
