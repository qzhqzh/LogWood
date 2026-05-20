import { describe, expect, it } from 'vitest'
import { detectFileKind, fileMatchesMime } from './file-signature'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const GIF_MAGIC = Buffer.from('GIF89a')
const WEBP_MAGIC = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
])
const AVI_MAGIC = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('AVI '),
])
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00])
const MP4_MAGIC = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from('ftyp'),
  Buffer.from('isom'),
])
const FAKE_HTML = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>')

describe('lib/file-signature', () => {
  describe('detectFileKind', () => {
    it('detects PNG', () => {
      expect(detectFileKind(PNG_MAGIC)).toBe('png')
    })

    it('detects JPEG', () => {
      expect(detectFileKind(JPEG_MAGIC)).toBe('jpeg')
    })

    it('detects GIF89a', () => {
      expect(detectFileKind(GIF_MAGIC)).toBe('gif')
    })

    it('detects WebP via RIFF/WEBP', () => {
      expect(detectFileKind(WEBP_MAGIC)).toBe('webp')
    })

    it('detects AVI via RIFF/AVI ', () => {
      expect(detectFileKind(AVI_MAGIC)).toBe('avi')
    })

    it('detects WebM/EBML', () => {
      expect(detectFileKind(WEBM_MAGIC)).toBe('webm')
    })

    it('detects MP4 (ISO BMFF ftyp)', () => {
      expect(detectFileKind(MP4_MAGIC)).toBe('mp4-family')
    })

    it('returns null for unknown content', () => {
      expect(detectFileKind(FAKE_HTML)).toBeNull()
    })

    it('returns null for too-short buffer', () => {
      expect(detectFileKind(Buffer.from([0xff]))).toBeNull()
    })
  })

  describe('fileMatchesMime', () => {
    it('accepts when signature matches the claimed MIME', () => {
      expect(fileMatchesMime(PNG_MAGIC, 'image/png')).toBe(true)
      expect(fileMatchesMime(JPEG_MAGIC, 'image/jpeg')).toBe(true)
    })

    it('rejects PNG body claimed as image/jpeg', () => {
      expect(fileMatchesMime(PNG_MAGIC, 'image/jpeg')).toBe(false)
    })

    it('rejects HTML disguised as image/png (R-03)', () => {
      expect(fileMatchesMime(FAKE_HTML, 'image/png')).toBe(false)
    })

    it('accepts mp4 as video/quicktime (shared ftyp container)', () => {
      expect(fileMatchesMime(MP4_MAGIC, 'video/quicktime')).toBe(true)
      expect(fileMatchesMime(MP4_MAGIC, 'video/3gpp')).toBe(true)
    })

    it('rejects unknown MIME types entirely', () => {
      expect(fileMatchesMime(PNG_MAGIC, 'image/svg+xml')).toBe(false)
    })
  })
})
