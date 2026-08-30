import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const isAdminSessionMock = vi.hoisted(() => vi.fn())
const getCandidateByIdMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/authz', () => ({ isAdminSession: isAdminSessionMock }))
vi.mock('@/modules/candidate', () => ({ getCandidateById: getCandidateByIdMock }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return { ...original, readFile: readFileMock }
})

import { GET } from './route'

const context = { params: { id: 'candidate-1' } }

function privateCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'candidate-1',
    authorUserId: 'owner-1',
    visibility: 'private',
    previewImageUrl: '/private-uploads/candidates/1724670000000-12345678-1234-1234-1234-123456789abc.webp',
    ...overrides,
  }
}

describe('GET /api/candidates/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAdminSessionMock.mockReturnValue(false)
    getCandidateByIdMock.mockResolvedValue(privateCandidate())
    readFileMock.mockResolvedValue(Buffer.from('private image'))
  })

  it('returns 404 to anonymous callers without looking up a private record', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost'), context)

    expect(response.status).toBe(404)
    expect(getCandidateByIdMock).not.toHaveBeenCalled()
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the signed-in user does not own the private Candidate', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'other-user' } })

    const response = await GET(new Request('http://localhost'), context)

    expect(response.status).toBe(404)
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('serves an owned private preview with non-cacheable security headers', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'owner-1' } })

    const response = await GET(new Request('http://localhost'), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('private image')
  })
})
