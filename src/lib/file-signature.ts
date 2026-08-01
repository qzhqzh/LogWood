/**
 * Magic-byte detection for the image and video types accepted by upload
 * routes. Container formats are identified precisely enough that a client
 * cannot relabel one ISO BMFF or EBML format as another allowed MIME type.
 */

export type FileKind =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'mp4'
  | 'quicktime'
  | '3gpp'
  | 'webm'
  | 'matroska'
  | 'ogg'
  | 'avi'
  | 'mpeg-ps'

const MIME_TO_KIND: Record<string, FileKind> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'quicktime',
  'video/3gpp': '3gpp',
  'video/x-matroska': 'matroska',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'video/x-msvideo': 'avi',
  'video/mpeg': 'mpeg-ps',
}

const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'M4V ',
  'F4V ',
  'MSNV',
])

function startsWith(buf: Buffer, ...bytes: number[]): boolean {
  if (buf.length < bytes.length) return false
  for (let i = 0; i < bytes.length; i++) {
    if (buf[i] !== bytes[i]) return false
  }
  return true
}

function detectIsoBmffKind(buf: Buffer): FileKind | null {
  if (
    buf.length < 12 ||
    buf[4] !== 0x66 ||
    buf[5] !== 0x74 ||
    buf[6] !== 0x79 ||
    buf[7] !== 0x70
  ) {
    return null
  }

  const majorBrand = buf.subarray(8, 12).toString('ascii')

  if (majorBrand === 'qt  ') return 'quicktime'
  if (
    majorBrand.startsWith('3gp') ||
    majorBrand.startsWith('3g2') ||
    majorBrand.startsWith('3ge') ||
    majorBrand.startsWith('3gg')
  ) {
    return '3gpp'
  }
  if (MP4_BRANDS.has(majorBrand)) return 'mp4'

  // Reject unknown and non-video brands such as heic/avif/M4A instead of
  // accepting every ISO BMFF file as an interchangeable video container.
  return null
}

function readEbmlVint(
  buf: Buffer,
  offset: number,
): { length: number; value: number } | null {
  const first = buf[offset]
  if (!first) return null

  let length = 1
  let marker = 0x80
  while (length <= 8 && (first & marker) === 0) {
    marker >>= 1
    length += 1
  }

  if (length > 8 || offset + length > buf.length) return null

  let value = first & (marker - 1)
  for (let i = 1; i < length; i++) {
    value = value * 256 + buf[offset + i]
  }

  return { length, value }
}

function detectEbmlKind(buf: Buffer): FileKind | null {
  if (!startsWith(buf, 0x1a, 0x45, 0xdf, 0xa3)) return null

  const scan = buf.subarray(0, Math.min(buf.length, 4096))

  for (let i = 4; i <= scan.length - 3; i++) {
    // EBML DocType element ID: 42 82
    if (scan[i] !== 0x42 || scan[i + 1] !== 0x82) continue

    const size = readEbmlVint(scan, i + 2)
    if (!size || size.value < 1 || size.value > 32) continue

    const valueStart = i + 2 + size.length
    const valueEnd = valueStart + size.value
    if (valueEnd > scan.length) continue

    const docType = scan.subarray(valueStart, valueEnd).toString('ascii').toLowerCase()
    if (docType === 'webm') return 'webm'
    if (docType === 'matroska') return 'matroska'
  }

  return null
}

/** Detect a supported file kind from its leading bytes. */
export function detectFileKind(buf: Buffer): FileKind | null {
  if (!buf || buf.length < 4) return null

  if (startsWith(buf, 0xff, 0xd8, 0xff)) return 'jpeg'

  if (startsWith(buf, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return 'png'
  }

  if (
    startsWith(buf, 0x47, 0x49, 0x46, 0x38, 0x37, 0x61) ||
    startsWith(buf, 0x47, 0x49, 0x46, 0x38, 0x39, 0x61)
  ) {
    return 'gif'
  }

  if (buf.length >= 12 && startsWith(buf, 0x52, 0x49, 0x46, 0x46)) {
    const fourcc = buf.subarray(8, 12).toString('ascii')
    if (fourcc === 'WEBP') return 'webp'
    if (fourcc === 'AVI ') return 'avi'
  }

  const ebmlKind = detectEbmlKind(buf)
  if (ebmlKind) return ebmlKind

  if (startsWith(buf, 0x4f, 0x67, 0x67, 0x53)) return 'ogg'

  const isoBmffKind = detectIsoBmffKind(buf)
  if (isoBmffKind) return isoBmffKind

  if (
    startsWith(buf, 0x00, 0x00, 0x01, 0xba) ||
    startsWith(buf, 0x00, 0x00, 0x01, 0xb3)
  ) {
    return 'mpeg-ps'
  }

  return null
}

/** Check whether detected content exactly matches the supplied MIME type. */
export function fileMatchesMime(buf: Buffer, mime: string): boolean {
  const expected = MIME_TO_KIND[mime]
  return Boolean(expected && detectFileKind(buf) === expected)
}
