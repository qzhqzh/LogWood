import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const isAdminSessionMock = vi.hoisted(() => vi.fn())
const archiveArticleMock = vi.hoisted(() => vi.fn())
const deleteArticleMock = vi.hoisted(() => vi.fn())
const recordAdminActionMock = vi.hoisted(() => vi.fn())
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/authz', () => ({ isAdminSession: isAdminSessionMock }))
vi.mock('@/modules/article', () => ({
  archiveArticle: archiveArticleMock,
  deleteArticle: deleteArticleMock,
  getArticleByIdForManage: vi.fn(),
  updateArticle: vi.fn(),
}))
vi.mock('@/modules/audit', () => ({ recordAdminAction: recordAdminActionMock }))

import { DELETE } from './route'

describe('DELETE /api/articles/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'admin-1' } })
    isAdminSessionMock.mockReturnValue(true)
  })

  it('archives the article without physically deleting it', async () => {
    archiveArticleMock.mockResolvedValue({
      id: 'article-1',
      status: 'archived',
      updatedAt: new Date('2026-08-23T00:00:00.000Z'),
    })

    const response = await DELETE(
      new Request('http://localhost/api/articles/article-1', { method: 'DELETE' }) as never,
      { params: { id: 'article-1' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'article-1' })
    expect(archiveArticleMock).toHaveBeenCalledOnce()
    expect(archiveArticleMock).toHaveBeenCalledWith('article-1')
    expect(deleteArticleMock).not.toHaveBeenCalled()
    expect(recordAdminActionMock).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'article.archive',
      targetType: 'article',
      targetId: 'article-1',
    })
  })
})
