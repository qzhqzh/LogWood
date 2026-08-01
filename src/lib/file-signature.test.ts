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

function isoBmff(majorBrand: string) {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftyp'),
    Buffer.from(majorBrand),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from(majorBrand),
  ])
}

function ebml(docType: 'webm' | 'matroska') {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from([0x42, 0x82, 0x80 | docType.length]),
    Buffer.from(docType),
  ])
}

const MP4_MAGIC = isoBmff('isom')
const QUICKTIME_MAGIC = isoBmff('qt  ')
const THREE_GPP_MAGIC = isoBmff('3gp6')
const HEIC_MAGIC = isoBmff('heic')
const M4A_MAGIC = isoBmff('M4A ')
const WEBM_MAGIC = ebml('webm')
const MATROSKA_MAGIC = ebml('matroska')
const MPEG_MAGIC = Buffer.from([0x00, 0x00, 0x01, 0xb3])
const FAKE_HTML = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>')

describe('lib/file-signature', () => {
  describe('detectFileKind', () => {
    it('detects supported image formats', () => {
      expect(detectFileKind(PNG_MAGIC)).toBe('png')
      expect(detectFileKind(JPEG_MAGIC)).toBe('jpeg')
      expect(detectFileKind(GIF_MAGIC)).toBe('gif')
      expect(detectFileKind(WEBP_MAGIC)).toBe('webp')
    })

    it('detects RIFF video', () => {
      expect(detectFileKind(AVI_MAGIC)).toBe('avi')
    })

    it('distinguishes WebM from Matroska using EBML DocType', () => {
      expect(detectFileKind(WEBM_MAGIC)).toBe('webm')
      expect(detectFileKind(MATROSKA_MAGIC)).toBe('matroska')
    })

    it('distinguishes ISO BMFF video brands', () => {
      expect(detectFileKind(MP4_MAGIC)).toBe('mp4')
      expect(detectFileKind(QUICKTIME_MAGIC)).toBe('quicktime')
      expect(detectFileKind(THREE_GPP_MAGIC)).toBe('3gpp')
    })

    it('rejects unsupported ISO BMFF brands', () => {
      expect(detectFileKind(HEIC_MAGIC)).toBeNull()
      expect(detectFileKind(M4A_MAGIC)).toBeNull()
    })

    it('detects MPEG video stream headers', () => {
      expect(detectFileKind(MPEG_MAGIC)).toBe('mpeg-ps')
    })

    it('returns null for unknown or incomplete content', () => {
      expect(detectFileKind(FAKE_HTML)).toBeNull()
      expect(detectFileKind(Buffer.from([0xff]))).toBeNull()
      expect(detectFileKind(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))).toBeNull()
    })
  })

  describe('fileMatchesMime', () => {
    it('accepts when signature exactly matches the claimed MIME', () => {
      expect(fileMatchesMime(PNG_MAGIC, 'image/png')).toBe(true)
      expect(fileMatchesMime(JPEG_MAGIC, 'image/jpeg')).toBe(true)
      expect(fileMatchesMime(MP4_MAGIC, 'video/mp4')).toBe(true)
      expect(fileMatchesMime(QUICKTIME_MAGIC, 'video/quicktime')).toBe(true)
      expect(fileMatchesMime(THREE_GPP_MAGIC, 'video/3gpp')).toBe(true)
      expect(fileMatchesMime(WEBM_MAGIC, 'video/webm')).toBe(true)
      expect(fileMatchesMime(MATROSKA_MAGIC, 'video/x-matroska')).toBe(true)
    })

    it('rejects mismatched image MIME types', () => {
      expect(fileMatchesMime(PNG_MAGIC, 'image/jpeg')).toBe(false)
      expect(fileMatchesMime(FAKE_HTML, 'image/png')).toBe(false)
    })

    it('does not treat MP4, QuickTime and 3GPP as interchangeable', () => {
      expect(fileMatchesMime(MP4_MAGIC, 'video/quicktime')).toBe(false)
      expect(fileMatchesMime(MP4_MAGIC, 'video/3gpp')).toBe(false)
      expect(fileMatchesMime(QUICKTIME_MAGIC, 'video/mp4')).toBe(false)
      expect(fileMatchesMime(THREE_GPP_MAGIC, 'video/mp4')).toBe(false)
    })

    it('rejects unsupported ISO BMFF formats disguised as video', () => {
      expect(fileMatchesMime(HEIC_MAGIC, 'video/mp4')).toBe(false)
      expect(fileMatchesMime(M4A_MAGIC, 'video/mp4')).toBe(false)
      expect(fileMatchesMime(MP4_MAGIC, 'video/mpeg')).toBe(false)
    })

    it('does not treat WebM and Matroska as interchangeable', () => {
      expect(fileMatchesMime(WEBM_MAGIC, 'video/x-matroska')).toBe(false)
      expect(fileMatchesMime(MATROSKA_MAGIC, 'video/webm')).toBe(false)
    })

    it('rejects unknown MIME types entirely', () => {
      expect(fileMatchesMime(PNG_MAGIC, 'image/svg+xml')).toBe(false)
    })
  })
})
