import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const isAdminSessionMock = vi.hoisted(() => vi.fn())
const fileMatchesMimeMock = vi.hoisted(() => vi.fn())
const persistPublicUploadMock = vi.hoisted(() => vi.fn())
const getPublicUploadLocationMock = vi.hoisted(() => vi.fn())
const updateCandidatePreviewMock = vi.hoisted(() => vi.fn())
const getCandidateByIdMock = vi.hoisted(() => vi.fn())
const updateSkillEffectMock = vi.hoisted(() => vi.fn())
const revalidatePathMock = vi.hoisted(() => vi.fn())
const persistPrivateCandidatePreviewMock = vi.hoisted(() => vi.fn())
const candidatePreviewClientUrlMock = vi.hoisted(() => vi.fn())
const unlinkMock = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('fs/promises', () => ({ unlink: unlinkMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/authz', () => ({ isAdminSession: isAdminSessionMock }))
vi.mock('@/lib/file-signature', () => ({ fileMatchesMime: fileMatchesMimeMock }))
vi.mock('@/lib/public-upload', () => ({
  getPublicUploadLocation: getPublicUploadLocationMock,
  persistPublicUpload: persistPublicUploadMock,
}))
vi.mock('@/lib/private-candidate-preview', () => ({
  persistPrivateCandidatePreview: persistPrivateCandidatePreviewMock,
  candidatePreviewClientUrl: candidatePreviewClientUrlMock,
}))
vi.mock('@/modules/candidate', () => ({
  getCandidateById: getCandidateByIdMock,
  updateCandidatePreview: updateCandidatePreviewMock,
}))
vi.mock('@/modules/skill', () => ({ updateSkillEffect: updateSkillEffectMock }))

import { POST } from './route'

function effectRequest(fields: Record<string, string> = {}) {
  const form = new FormData()
  form.set('file', new File(['safe image bytes'], 'capture.png', { type: 'image/png' }))
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return new Request('http://localhost/api/uploads/skill-effect', {
    method: 'POST',
    body: form,
  })
}

describe('POST /api/uploads/skill-effect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'admin-1' } })
    isAdminSessionMock.mockReturnValue(true)
    fileMatchesMimeMock.mockReturnValue(true)
    getPublicUploadLocationMock.mockReturnValue({
      absolutePath: '/app/public/uploads/skill-effects/capture.png',
      publicUrl: '/uploads/skill-effects/capture.png',
    })
    persistPublicUploadMock.mockResolvedValue('/uploads/skill-effects/capture.png')
    updateSkillEffectMock.mockResolvedValue({ id: 'skill-1', slug: 'saved-prompt' })
    getCandidateByIdMock.mockResolvedValue({
      id: 'candidate-1',
      slug: 'draft-capture',
      visibility: 'public',
    })
    updateCandidatePreviewMock.mockResolvedValue({ id: 'candidate-1', slug: 'draft-capture' })
    persistPrivateCandidatePreviewMock.mockResolvedValue({
      absolutePath: '/app/data/private-uploads/candidates/capture.png',
      reference: '/private-uploads/candidates/1724670000000-12345678-1234-1234-1234-123456789abc.png',
    })
    candidatePreviewClientUrlMock.mockReturnValue('/api/candidates/candidate-1/preview')
    unlinkMock.mockResolvedValue(undefined)
  })

  it('rejects anonymous uploads before reading or writing a file', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(effectRequest())

    expect(response.status).toBe(401)
    expect(persistPublicUploadMock).not.toHaveBeenCalled()
  })

  it('binds a verified upload to only the selected Skill effect fields', async () => {
    const response = await POST(effectRequest({
      recordType: 'skill',
      recordId: 'skill-1',
    }))

    expect(response.status).toBe(200)
    expect(updateSkillEffectMock).toHaveBeenCalledWith({
      id: 'skill-1',
      effectImageUrl: '/uploads/skill-effects/capture.png',
      effectNote: undefined,
    })
    expect(updateCandidatePreviewMock).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      url: '/uploads/skill-effects/capture.png',
      record: { id: 'skill-1' },
    })
  })

  it('rejects an incomplete record binding without persisting the upload', async () => {
    const response = await POST(effectRequest({ recordType: 'candidate' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'ERR_EFFECT_BINDING' })
    expect(persistPublicUploadMock).not.toHaveBeenCalled()
    expect(persistPrivateCandidatePreviewMock).not.toHaveBeenCalled()
  })

  it('stores a private Candidate replacement outside public uploads', async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: 'candidate-1',
      slug: 'draft-capture',
      visibility: 'private',
    })

    const response = await POST(effectRequest({
      recordType: 'candidate',
      recordId: 'candidate-1',
    }))

    expect(response.status).toBe(200)
    expect(persistPrivateCandidatePreviewMock).toHaveBeenCalledWith({
      fileName: expect.stringMatching(/\.png$/),
      buffer: expect.any(Buffer),
    })
    expect(persistPublicUploadMock).not.toHaveBeenCalled()
    expect(updateCandidatePreviewMock).toHaveBeenCalledWith({
      id: 'candidate-1',
      previewImageUrl: expect.stringMatching(/^\/private-uploads\/candidates\//),
    })
    expect(await response.json()).toMatchObject({
      url: '/api/candidates/candidate-1/preview',
      record: { id: 'candidate-1' },
    })
  })

  it('rolls back a private replacement if visibility changes concurrently', async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: 'candidate-1',
      slug: 'draft-capture',
      visibility: 'private',
    })
    updateCandidatePreviewMock.mockRejectedValue(new Error('ERR_CANDIDATE_STATE_CONFLICT'))

    const response = await POST(effectRequest({
      recordType: 'candidate',
      recordId: 'candidate-1',
    }))

    expect(response.status).toBe(409)
    expect(unlinkMock).toHaveBeenCalledWith('/app/data/private-uploads/candidates/capture.png')
    expect(await response.json()).toEqual({ error: 'ERR_CANDIDATE_STATE_CONFLICT' })
  })
})
