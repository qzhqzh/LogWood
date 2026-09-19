import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const isAdminSessionMock = vi.hoisted(() => vi.fn())
const appendThoughtMessageMock = vi.hoisted(() => vi.fn())
const listThoughtSessionsMock = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/authz', () => ({ isAdminSession: isAdminSessionMock }))
vi.mock('@/modules/thought', () => ({
  appendThoughtMessage: appendThoughtMessageMock,
  listThoughtSessions: listThoughtSessionsMock,
}))

import { POST } from './route'

describe('POST /api/thoughts/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'admin-1' } })
    isAdminSessionMock.mockReturnValue(true)
  })

  it('reports a provider outage while confirming the user message was saved', async () => {
    appendThoughtMessageMock.mockResolvedValue({
      session: { id: 'thought-1', turnCount: 1 },
      error: 'ERR_THOUGHT_AI_UNAVAILABLE',
      retryable: true,
    })

    const response = await POST(new Request('http://localhost/api/thoughts/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'request-0001',
        content: '我想先把这个还不完整的判断保存下来。',
        action: 'chat',
      }),
    }) as never)

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: 'ERR_THOUGHT_AI_UNAVAILABLE',
      saved: true,
      session: { id: 'thought-1' },
    })
  })
})
