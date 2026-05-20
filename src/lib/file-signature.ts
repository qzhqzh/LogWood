/**
 * Magic-byte (file signature) detection for the file types we accept in
 * uploads.
 *
 * Why we need this (R-03): the upload routes previously trusted only
 * `file.type` (browser-supplied MIME) and the file extension derived from it.
 * That makes it trivial to upload arbitrary content disguised as an image or
 * video — for example, a `.html` file with `Content-Type: image/png` sails
 * through. Public `/uploads/articles/*.png` could then be served as raw HTML
 * by some downstream tools, or used as malware staging.
 *
 * Approach: read the first ~16 bytes of the body, compare against known
 * signatures, and only accept the upload if the detected kind matches the
 * claimed MIME. Pure byte comparison, no new dependencies.
 *
 * Coverage matches the MIME allowlists in:
 *   - `src/app/api/uploads/article-image/route.ts`
 *   - `src/app/api/uploads/article-video/route.ts`
 */

export type FileKind =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'mp4-family' // any ISO BMFF ftyp container (mp4, mov, m4a, 3gp...)
  | 'webm'
  | 'ogg'
  | 'avi'
  | 'mpeg-ps'

const MIME_TO_KIND: Record<string, FileKind | FileKind[]> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4-family',
  'video/quicktime': 'mp4-family',
  'video/3gpp': 'mp4-family',
  'video/x-matroska': 'webm', // matroska shares EBML header with webm
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'video/x-msvideo': 'avi',
  'video/mpeg': ['mpeg-ps', 'mp4-family'],
}

function startsWith(buf: Buffer, ...bytes: number[]): boolean {
  if (buf.length < bytes.length) return false
  for (let i = 0; i < bytes.length; i++) {
    if (buf[i] !== bytes[i]) return false
  }
  return true
}

/**
 * Detect a file kind from its first bytes. Returns `null` when the buffer
 * does not match any known signature.
 */
export function detectFileKind(buf: Buffer): FileKind | null {
  if (!buf || buf.length < 4) return null

  // JPEG: FF D8 FF
  if (startsWith(buf, 0xff, 0xd8, 0xff)) return 'jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png'

  // GIF87a / GIF89a
  if (
    startsWith(buf, 0x47, 0x49, 0x46, 0x38, 0x37, 0x61) ||
    startsWith(buf, 0x47, 0x49, 0x46, 0x38, 0x39, 0x61)
  ) {
    return 'gif'
  }

  // RIFF .... WEBP / AVI : "RIFF" + 4 bytes size + 4-byte fourcc
  if (
    buf.length >= 12 &&
    startsWith(buf, 0x52, 0x49, 0x46, 0x46) // "RIFF"
  ) {
    const fourcc = buf.subarray(8, 12).toString('ascii')
    if (fourcc === 'WEBP') return 'webp'
    if (fourcc === 'AVI ') return 'avi'
  }

  // EBML (WebM / Matroska): 1A 45 DF A3
  if (startsWith(buf, 0x1a, 0x45, 0xdf, 0xa3)) return 'webm'

  // OggS
  if (startsWith(buf, 0x4f, 0x67, 0x67, 0x53)) return 'ogg'

  // ISO BMFF ftyp container: bytes 4-7 are "ftyp"
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    return 'mp4-family'
  }

  // MPEG program/elementary stream: 00 00 01 (BA = pack header, B3 = sequence)
  if (
    startsWith(buf, 0x00, 0x00, 0x01, 0xba) ||
    startsWith(buf, 0x00, 0x00, 0x01, 0xb3)
  ) {
    return 'mpeg-ps'
  }

  return null
}

/**
 * Check whether `buf`'s detected file kind is compatible with the supplied
 * MIME type (per the upload allowlists). Used as the gate before persisting
 * an upload.
 */
export function fileMatchesMime(buf: Buffer, mime: string): boolean {
  const kind = detectFileKind(buf)
  if (!kind) return false
  const expected = MIME_TO_KIND[mime]
  if (!expected) return false
  return Array.isArray(expected) ? expected.includes(kind) : expected === kind
}
