import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  candidate: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  article: { findFirst: vi.fn() },
}))
const createCandidateMock = vi.hoisted(() => vi.fn())
const generateThoughtReplyMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/modules/candidate', () => ({ createCandidate: createCandidateMock }))
vi.mock('@/modules/article/sanitize', () => ({ sanitizeArticleHtml: (value: string) => value }))
vi.mock('./provider', () => ({
  ThoughtProviderError: class ThoughtProviderError extends Error {},
  generateThoughtReply: generateThoughtReplyMock,
}))

import { appendThoughtMessage, buildThoughtDraftInput } from './service'

function raw(turns: Array<Record<string, unknown>>) {
  return JSON.stringify({ schema: 'logwood.thought-session.v1', turns })
}

const firstTurn = {
  id: 'request-0001',
  role: 'user',
  content: '真正稀缺的可能不是效率，而是没有被切碎的注意力。',
  createdAt: '2026-08-30T08:00:00.000Z',
}

describe('thought/service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.article.findFirst.mockResolvedValue(null)
  })

  it('records a new message in a private thought session without invoking AI', async () => {
    createCandidateMock.mockResolvedValue({ id: 'thought-1' })
    prismaMock.candidate.findFirst.mockResolvedValue({
      id: 'thought-1',
      title: '真正稀缺的可能不是效率',
      summary: firstTurn.content,
      rawContent: raw([firstTurn]),
      updatedAt: new Date('2026-08-30T08:00:00.000Z'),
    })

    const result = await appendThoughtMessage({
      requestId: 'request-0001',
      content: firstTurn.content,
      action: 'record',
    }, 'user-1')

    expect(createCandidateMock).toHaveBeenCalledWith(expect.objectContaining({
      visibility: 'private',
      tags: expect.arrayContaining(['thought-session', '思想对话']),
    }), 'user-1')
    expect(generateThoughtReplyMock).not.toHaveBeenCalled()
    expect(result.session.turnCount).toBe(1)
  })

  it('builds article material from the full, attributed discussion', async () => {
    prismaMock.candidate.findFirst.mockResolvedValue({
      id: 'thought-1',
      title: '注意力不是剩余资源',
      summary: firstTurn.content,
      rawContent: raw([
        firstTurn,
        {
          id: 'request-0001:reply',
          role: 'assistant',
          content: '这意味着工具应该被评价为是否归还注意力。',
          createdAt: '2026-08-30T08:01:00.000Z',
          replyTo: 'request-0001',
        },
      ]),
      updatedAt: new Date('2026-08-30T08:01:00.000Z'),
    })

    const result = await buildThoughtDraftInput('thought-1', 'user-1')

    expect(result.sourceCandidateId).toBe('thought-1')
    expect(result.prompt).toContain('【作者】')
    expect(result.prompt).toContain('【思想协作者】')
    expect(result.prompt).toContain('不是逐轮复述对话')
  })
})
