import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const isAdminSessionMock = vi.hoisted(() => vi.fn())
const getThoughtSessionMock = vi.hoisted(() => vi.fn())
const approveAndPublishArticleMock = vi.hoisted(() => vi.fn())
const recordAdminActionMock = vi.hoisted(() => vi.fn())
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/authz', () => ({ isAdminSession: isAdminSessionMock }))
vi.mock('@/modules/thought', () => ({ getThoughtSession: getThoughtSessionMock }))
vi.mock('@/modules/article', () => ({ approveAndPublishArticle: approveAndPublishArticleMock }))
vi.mock('@/modules/audit', () => ({ recordAdminAction: recordAdminActionMock }))

import { POST } from './route'

describe('POST /api/thoughts/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'admin-1' } })
    isAdminSessionMock.mockReturnValue(true)
    getThoughtSessionMock.mockResolvedValue({
      id: 'thought-1',
      article: { id: 'article-1' },
    })
  })

  it('uses one explicit confirmation to approve and publish the expected version', async () => {
    approveAndPublishArticleMock.mockResolvedValue({
      id: 'article-1',
      slug: 'attention-is-not-leftover',
      currentVersion: 3,
      status: 'published',
    })

    const response = await POST(new Request('http://localhost/api/thoughts/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'thought-1',
        articleId: 'article-1',
        expectedVersion: 3,
      }),
    }) as never)

    expect(response.status).toBe(200)
    expect(approveAndPublishArticleMock).toHaveBeenCalledWith({
      id: 'article-1',
      reviewerUserId: 'admin-1',
      authorUserId: 'admin-1',
      expectedVersion: 3,
    })
    expect(recordAdminActionMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'thought.article.approve_publish',
      targetId: 'article-1',
    }))
  })
})
