import { createHash } from 'node:crypto'
import { zipSync } from 'fflate'
import { parseDocument } from 'yaml'

export const MAX_REQUEST_BYTES = 10 * 1024 * 1024
export const MAX_BUNDLE_BYTES = 8 * 1024 * 1024
export const MAX_FILE_BYTES = 3 * 1024 * 1024
export const MAX_FILES = 80
const SAFE_PATH_SEGMENT = new RegExp('^[\\p{L}\\p{N}._ +()-]+$', 'u')

export class SkillHubError extends Error {
  constructor(public code: string, public status = 400) {
    super(code)
  }
}

export interface SkillBundleFile {
  path: string
  bytes: Uint8Array
}

export interface SkillBundle {
  name: string
  description: string
  license: string | null
  instructions: string
  archive: Buffer
  archiveHash: string
  sourceHash: string
  fileManifest: string
}

function safePath(path: string) {
  if (!path || path.length > 240 || path.includes('\\') || path.startsWith('/')) {
    throw new SkillHubError('ERR_SKILL_HUB_PATH')
  }
  const parts = path.split('/')
  if (parts.length > 7 || parts.some((part) => (
    !part || part === '.' || part === '..' || part.startsWith('.')
    || ['__proto__', 'prototype', 'constructor'].includes(part)
    || !SAFE_PATH_SEGMENT.test(part)
  ))) throw new SkillHubError('ERR_SKILL_HUB_PATH')
  return parts.join('/')
}

function skillMetadata(instructions: string) {
  const frontmatter = instructions.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) throw new SkillHubError('ERR_SKILL_HUB_FRONTMATTER')
  let data: Record<string, unknown> | null
  try {
    const document = parseDocument(frontmatter[1], { uniqueKeys: true })
    if (document.errors.length) throw new Error('Invalid YAML')
    data = document.toJS({ maxAliasCount: 0 }) as Record<string, unknown> | null
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid frontmatter object')
    }
  } catch {
    throw new SkillHubError('ERR_SKILL_HUB_FRONTMATTER')
  }
  const name = data?.name
  const description = data?.description
  if (typeof name !== 'string' || name.length > 64
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
    || typeof description !== 'string' || !description.trim()
    || description.length > 1024) {
    throw new SkillHubError('ERR_SKILL_HUB_FRONTMATTER')
  }
  if (data?.license !== undefined && (typeof data.license !== 'string' || data.license.length > 180)) {
    throw new SkillHubError('ERR_SKILL_HUB_FRONTMATTER')
  }
  return { name, description: description.trim(), license: (data?.license as string | undefined) || null }
}

export function buildSkillBundle(files: SkillBundleFile[], folderName?: string): SkillBundle {
  if (!files.length || files.length > MAX_FILES) throw new SkillHubError('ERR_SKILL_HUB_FILE_COUNT')
  const seen = new Set<string>()
  let total = 0
  const sorted = files.map((file) => {
    const path = safePath(file.path)
    const normalized = path.toLocaleLowerCase()
    if (seen.has(normalized)) throw new SkillHubError('ERR_SKILL_HUB_PATH')
    seen.add(normalized)
    if (!file.bytes.length || file.bytes.length > MAX_FILE_BYTES) {
      throw new SkillHubError('ERR_SKILL_HUB_FILE_SIZE')
    }
    total += file.bytes.length
    if (total > MAX_BUNDLE_BYTES) throw new SkillHubError('ERR_SKILL_HUB_FILE_SIZE')
    return { path, bytes: file.bytes }
  }).sort((left, right) => left.path.localeCompare(right.path, 'en'))

  const entry = sorted.find((file) => file.path === 'SKILL.md')
  if (!entry || entry.bytes.length > 256 * 1024) throw new SkillHubError('ERR_SKILL_HUB_SKILL_MD')
  let instructions: string
  try {
    instructions = new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes)
  } catch {
    throw new SkillHubError('ERR_SKILL_HUB_SKILL_MD')
  }
  const metadata = skillMetadata(instructions)
  if (folderName && folderName !== metadata.name) throw new SkillHubError('ERR_SKILL_HUB_FOLDER_NAME')

  const digest = createHash('sha256')
  const entries: Record<string, Uint8Array> = Object.create(null)
  for (const file of sorted) {
    digest.update(file.path).update('\0').update(String(file.bytes.length)).update('\0')
    digest.update(file.bytes)
    entries[file.path] = file.bytes
  }
  const archive = Buffer.from(zipSync(entries, { level: 6 }))
  if (archive.length > MAX_BUNDLE_BYTES) throw new SkillHubError('ERR_SKILL_HUB_FILE_SIZE')
  return {
    ...metadata,
    instructions,
    archive,
    archiveHash: createHash('sha256').update(archive).digest('hex'),
    sourceHash: digest.digest('hex'),
    fileManifest: JSON.stringify(sorted.map((file) => ({ path: file.path, size: file.bytes.length }))),
  }
}

export async function readLimitedMultipart(request: Request) {
  const size = Number(request.headers.get('content-length'))
  if (Number.isFinite(size) && size > MAX_REQUEST_BYTES) {
    throw new SkillHubError('ERR_SKILL_HUB_FILE_SIZE', 413)
  }
  if (!request.body) throw new SkillHubError('ERR_SKILL_HUB_FILE_COUNT')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel()
      throw new SkillHubError('ERR_SKILL_HUB_FILE_SIZE', 413)
    }
    chunks.push(value)
  }
  const formRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': request.headers.get('content-type') || '' },
    body: Buffer.concat(chunks),
  })
  return formRequest.formData()
}

export async function bundleFromForm(form: FormData) {
  if (form.get('rightsConfirmed') !== 'true') throw new SkillHubError('ERR_SKILL_HUB_RIGHTS')
  const files = form.getAll('file')
  let paths: unknown
  try { paths = JSON.parse(String(form.get('paths') || '')) } catch { /* invalid input */ }
  if (!Array.isArray(paths) || paths.length !== files.length || files.length > MAX_FILES) {
    throw new SkillHubError('ERR_SKILL_HUB_FILE_COUNT')
  }
  const entries: SkillBundleFile[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!(file instanceof File) || typeof paths[i] !== 'string') {
      throw new SkillHubError('ERR_SKILL_HUB_FILE_COUNT')
    }
    if (file.size > MAX_FILE_BYTES) throw new SkillHubError('ERR_SKILL_HUB_FILE_SIZE')
    entries.push({ path: paths[i], bytes: new Uint8Array(await file.arrayBuffer()) })
  }
  const folderName = form.get('folderName')
  if (typeof folderName !== 'string' || !folderName) {
    throw new SkillHubError('ERR_SKILL_HUB_FOLDER_NAME')
  }
  return buildSkillBundle(entries, folderName)
}
