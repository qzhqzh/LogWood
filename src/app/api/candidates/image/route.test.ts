import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const fileMatchesMimeMock = vi.hoisted(() => vi.fn())
const createCandidateMock = vi.hoisted(() => vi.fn())
const assessContentMock = vi.hoisted(() => vi.fn())
const checkAndConsumeMock = vi.hoisted(() => vi.fn())
const persistPrivateCandidatePreviewMock = vi.hoisted(() => vi.fn())
const candidatePreviewClientUrlMock = vi.hoisted(() => vi.fn())
const revalidatePathMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())
const unlinkMock = vi.hoisted(() => vi.fn())
const sharpMock = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/file-signature', () => ({ fileMatchesMime: fileMatchesMimeMock }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/modules/candidate', () => ({ createCandidate: createCandidateMock }))
vi.mock('@/modules/like', () => ({ assessContent: assessContentMock }))
vi.mock('@/modules/rate-limit', () => ({ checkAndConsume: checkAndConsumeMock }))
vi.mock('@/lib/private-candidate-preview', () => ({
  persistPrivateCandidatePreview: persistPrivateCandidatePreviewMock,
  candidatePreviewClientUrl: candidatePreviewClientUrlMock,
}))
vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  unlink: unlinkMock,
}))
vi.mock('sharp', () => ({ default: sharpMock }))

import { POST } from './route'

function imageRequest() {
  const form = new FormData()
  form.set('file', new File(['safe png bytes'], 'capture.png', { type: 'image/png' }))
  form.set('title', 'Untitled Capture')
  form.set('prompt', '')
  form.set('privateDraft', '1')
  form.set('tags', 'output:image')
  return new Request('http://localhost/api/candidates/image', {
    method: 'POST',
    headers: { 'content-length': '1024' },
    body: form,
  })
}

describe('POST /api/candidates/image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'owner-1' } })
    fileMatchesMimeMock.mockReturnValue(true)
    assessContentMock.mockReturnValue({ flagged: false })
    checkAndConsumeMock.mockResolvedValue({ allowed: true })
    persistPrivateCandidatePreviewMock.mockResolvedValue({
      absolutePath: '/app/data/private-uploads/candidates/private.webp',
      reference: '/private-uploads/candidates/1724670000000-12345678-1234-1234-1234-123456789abc.webp',
    })
    candidatePreviewClientUrlMock.mockReturnValue('/api/candidates/candidate-1/preview')
    createCandidateMock.mockResolvedValue({
      id: 'candidate-1',
      slug: 'untitled-capture',
      title: 'Untitled Capture',
      previewImageUrl: '/private-uploads/candidates/1724670000000-12345678-1234-1234-1234-123456789abc.webp',
      visibility: 'private',
    })
    const pipeline = {
      rotate: vi.fn(),
      resize: vi.fn(),
      webp: vi.fn(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('sanitized webp')),
    }
    pipeline.rotate.mockReturnValue(pipeline)
    pipeline.resize.mockReturnValue(pipeline)
    pipeline.webp.mockReturnValue(pipeline)
    sharpMock.mockReturnValue(pipeline)
  })

  it('rejects anonymous uploads before reading or writing a file', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(imageRequest())

    expect(response.status).toBe(401)
    expect(persistPrivateCandidatePreviewMock).not.toHaveBeenCalled()
    expect(createCandidateMock).not.toHaveBeenCalled()
  })

  it('stores screenshot-first private Candidates outside public uploads', async () => {
    const response = await POST(imageRequest())

    expect(response.status).toBe(201)
    expect(persistPrivateCandidatePreviewMock).toHaveBeenCalledWith({
      fileName: expect.stringMatching(/\.webp$/),
      buffer: Buffer.from('sanitized webp'),
    })
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(createCandidateMock).toHaveBeenCalledWith(expect.objectContaining({
      rawContent: undefined,
      previewImageUrl: expect.stringMatching(/^\/private-uploads\/candidates\//),
      visibility: 'private',
    }), 'owner-1')
    expect(await response.json()).toMatchObject({
      candidate: {
        id: 'candidate-1',
        previewImageUrl: '/api/candidates/candidate-1/preview',
      },
    })
  })

  it('does not delete a committed private preview when revalidation fails', async () => {
    revalidatePathMock.mockImplementation(() => {
      throw new Error('revalidation failed')
    })

    const response = await POST(imageRequest())

    expect(response.status).toBe(500)
    expect(createCandidateMock).toHaveBeenCalled()
    expect(unlinkMock).not.toHaveBeenCalled()
  })
})
