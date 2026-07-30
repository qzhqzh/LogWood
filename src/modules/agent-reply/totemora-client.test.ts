import { describe, expect, it, vi } from 'vitest'
import { TotemoraClient } from './totemora-client'

describe('agent-reply/totemora-client', () => {
  it('uses the selected tribe member and preserves its attribution', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        members: [{
          id: 'qwen_worker',
          name: '千工',
          provider: 'qwen',
          model: 'qwen3.7-plus',
          version: 'member-v2',
          status: 'active',
        }],
      }))
      .mockResolvedValueOnce(Response.json({
        reply: {
          content: '先把事务边界说清楚。',
          at: '2026-07-29T12:00:00.000Z',
        },
      }))
    const client = new TotemoraClient({
      baseUrl: 'http://127.0.0.1:4310/',
      operatorToken: 'operator-secret',
      fetchImpl: fetchMock,
    })

    const result = await client.chat('qwen_worker', '给出候选回复')

    expect(result.member.model).toBe('qwen3.7-plus')
    expect(result.generatedAt).toEqual(new Date('2026-07-29T12:00:00.000Z'))
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:4310/api/members/qwen_worker/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer operator-secret',
        }),
      }),
    )
  })

  it('returns a stable error without reflecting gateway response details', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        members: [{
          id: 'deepseek_reasoner',
          provider: 'deepseek',
          model: 'deepseek-v4-pro',
          status: 'active',
        }],
      }))
      .mockResolvedValueOnce(new Response('operator-secret leaked', { status: 401 }))
    const client = new TotemoraClient({
      baseUrl: 'http://127.0.0.1:4310',
      operatorToken: 'operator-secret',
      fetchImpl: fetchMock,
    })

    await expect(client.chat('deepseek_reasoner', 'reply'))
      .rejects.toThrow('ERR_TOTEMORA_CHAT_FAILED')
  })

  it('reuses one tribe lookup across concurrent member chats', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        members: [
          {
            id: 'qwen_worker',
            provider: 'qwen',
            model: 'qwen3.7-plus',
            status: 'active',
          },
          {
            id: 'deepseek_reasoner',
            provider: 'deepseek',
            model: 'deepseek-v4-pro',
            status: 'active',
          },
        ],
      }))
      .mockResolvedValueOnce(Response.json({
        reply: { content: 'Qwen 候选' },
      }))
      .mockResolvedValueOnce(Response.json({
        reply: { content: 'DeepSeek 候选' },
      }))
    const client = new TotemoraClient({
      baseUrl: 'http://127.0.0.1:4310',
      operatorToken: 'operator-secret',
      fetchImpl: fetchMock,
    })

    await Promise.all([
      client.chat('qwen_worker', '候选一'),
      client.chat('deepseek_reasoner', '候选二'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/tribe')))
      .toHaveLength(1)
  })
})
