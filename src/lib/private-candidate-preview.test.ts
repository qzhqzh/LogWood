import { describe, expect, it } from 'vitest'
import {
  candidatePreviewClientUrl,
  isPrivateCandidatePreview,
  privateCandidatePreviewLocation,
  privateCandidatePreviewMime,
} from './private-candidate-preview'

const REFERENCE = '/private-uploads/candidates/1724670000000-12345678-1234-1234-1234-123456789abc.webp'

describe('private Candidate preview references', () => {
  it('maps a valid storage reference to the authenticated media route', () => {
    expect(isPrivateCandidatePreview(REFERENCE)).toBe(true)
    expect(candidatePreviewClientUrl('candidate-1', REFERENCE))
      .toBe('/api/candidates/candidate-1/preview')
    expect(privateCandidatePreviewMime(REFERENCE)).toBe('image/webp')
  })

  it('leaves public preview URLs unchanged', () => {
    expect(candidatePreviewClientUrl('candidate-1', '/uploads/candidates/public.webp'))
      .toBe('/uploads/candidates/public.webp')
  })

  it('rejects traversal and malformed private filenames', () => {
    expect(() => privateCandidatePreviewLocation('../secret.webp'))
      .toThrow('ERR_PRIVATE_PREVIEW_NAME')
    expect(isPrivateCandidatePreview('/private-uploads/candidates/../secret.webp')).toBe(false)
  })
})
