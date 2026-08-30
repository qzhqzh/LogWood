import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

const PRIVATE_PREVIEW_PREFIX = '/private-uploads/candidates/'
const PRIVATE_PREVIEW_FILE = /^\d{10,17}-[0-9a-f-]{36}\.(?:gif|jpe?g|png|webp)$/i

export function isPrivateCandidatePreview(reference?: string | null): boolean {
  if (!reference?.startsWith(PRIVATE_PREVIEW_PREFIX)) return false
  return PRIVATE_PREVIEW_FILE.test(reference.slice(PRIVATE_PREVIEW_PREFIX.length))
}

export function privateCandidatePreviewLocation(fileName: string) {
  if (!PRIVATE_PREVIEW_FILE.test(fileName)) {
    throw new Error('ERR_PRIVATE_PREVIEW_NAME')
  }
  const directory = path.join(process.cwd(), 'data', 'private-uploads', 'candidates')
  return {
    absolutePath: path.join(directory, fileName),
    directory,
    reference: `${PRIVATE_PREVIEW_PREFIX}${fileName}`,
  }
}

export async function persistPrivateCandidatePreview(input: {
  fileName: string
  buffer: Buffer
}) {
  const location = privateCandidatePreviewLocation(input.fileName)
  await mkdir(location.directory, { recursive: true, mode: 0o700 })
  await writeFile(location.absolutePath, input.buffer, { flag: 'wx', mode: 0o600 })
  return location
}

export function privateCandidatePreviewPath(reference?: string | null): string | null {
  if (!isPrivateCandidatePreview(reference)) return null
  return privateCandidatePreviewLocation(reference!.slice(PRIVATE_PREVIEW_PREFIX.length)).absolutePath
}

export function candidatePreviewClientUrl(
  candidateId: string,
  reference?: string | null,
): string | null {
  if (!reference) return null
  return isPrivateCandidatePreview(reference)
    ? `/api/candidates/${encodeURIComponent(candidateId)}/preview`
    : reference
}

export function privateCandidatePreviewMime(reference: string): string | null {
  if (!isPrivateCandidatePreview(reference)) return null
  const extension = reference.slice(reference.lastIndexOf('.') + 1).toLowerCase()
  return {
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }[extension] ?? null
}
