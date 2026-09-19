#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MAX_FILES = 80
const MAX_FILE_BYTES = 3 * 1024 * 1024
const MAX_BUNDLE_BYTES = 8 * 1024 * 1024

const usage = `Usage:
  LOGWOOD_SKILLHUB_URL=https://your-site LOGWOOD_SKILLHUB_TOKEN=lwsh_... node scripts/skillhub.mjs sync ./my-skill --confirm-rights [--dry-run]
  LOGWOOD_SKILLHUB_URL=https://your-site LOGWOOD_SKILLHUB_TOKEN=lwsh_... node scripts/skillhub.mjs sync ./skills --all --confirm-rights
  LOGWOOD_SKILLHUB_URL=https://your-site LOGWOOD_SKILLHUB_TOKEN=lwsh_... node scripts/skillhub.mjs push ./my-skill --confirm-rights
  LOGWOOD_SKILLHUB_URL=https://your-site node scripts/skillhub.mjs download <slug> [--version 1.0.0] [--output ./file.zip]

Sync is one-way publish: it never installs, executes, or overwrites local Skill files.
Use LOGWOOD_SKILLHUB_ALLOW_INSECURE_HTTP=1 only for a trusted LAN test.\n`

const [command, target, ...options] = process.argv.slice(2)
function option(name) {
  const index = options.indexOf(name)
  return index < 0 ? null : options[index + 1]
}
const has = (flag) => options.includes(flag)

function registryUrl() {
  const raw = process.env.LOGWOOD_SKILLHUB_URL
  if (!raw) throw new Error('Set LOGWOOD_SKILLHUB_URL to your Skill Hub URL.')
  const url = new URL(raw)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || process.env.LOGWOOD_SKILLHUB_ALLOW_INSECURE_HTTP === '1'
  ))) throw new Error('Use HTTPS for publishing tokens; insecure LAN HTTP requires explicit opt-in.')
  if (url.protocol === 'http:' && process.env.LOGWOOD_SKILLHUB_ALLOW_INSECURE_HTTP === '1') {
    process.stderr.write('Warning: your publish token will travel over unencrypted HTTP.\n')
  }
  return url.origin
}

async function requestJson(url, init) {
  const response = await fetch(url, init)
  const body = await response.json()
  if (!response.ok) throw new Error(`${body.error || 'Request failed'} (${response.status})`)
  return body
}

function authHeaders() {
  const token = process.env.LOGWOOD_SKILLHUB_TOKEN
  if (!token?.startsWith('lwsh_')) throw new Error('Set LOGWOOD_SKILLHUB_TOKEN to a token from the Skill Hub page.')
  return { Authorization: `Bearer ${token}` }
}

async function readSkillFolder(directory) {
  const folderName = path.basename(path.resolve(directory))
  const files = []
  let totalBytes = 0
  async function visit(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${entry.name}`)
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(folder, entry.name)
      if (entry.isDirectory()) await visit(absolute, relative)
      else if (entry.isFile()) {
        const { size } = await stat(absolute)
        if (!size || size > MAX_FILE_BYTES || (totalBytes += size) > MAX_BUNDLE_BYTES) {
          throw new Error(`Skill file size limit exceeded: ${relative}`)
        }
        files.push({ path: relative, bytes: await readFile(absolute) })
      }
      else throw new Error(`Unsupported file: ${relative}`)
      if (files.length > MAX_FILES) throw new Error('A Skill may contain at most 80 files.')
    }
  }
  await visit(directory)
  if (!files.some((file) => file.path === 'SKILL.md')) throw new Error(`${directory} has no root SKILL.md.`)
  files.sort((left, right) => left.path.localeCompare(right.path, 'en'))
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.path).update('\0').update(String(file.bytes.length)).update('\0').update(file.bytes)
  }
  return { name: folderName, files, sourceHash: hash.digest('hex') }
}

async function submit(directory, base, always) {
  const skill = await readSkillFolder(directory)
  const headers = authHeaders()
  if (!always) {
    const { skills } = await requestJson(`${base}/api/awesome/skills/hub?mine=1`, { headers })
    const existing = skills.find((item) => item.name === skill.name)
    if (existing?.releases.some((release) => release.sourceHash === skill.sourceHash && release.status !== 'rejected')) {
      process.stdout.write(`${skill.name}: unchanged, skipped.\n`)
      return
    }
    if (existing?.releases.some((release) => release.status === 'pending')) {
      throw new Error(`${skill.name}: a version is already pending review.`)
    }
  }
  if (has('--dry-run')) {
    process.stdout.write(`${skill.name}: ${skill.files.length} files would be submitted (${skill.sourceHash.slice(0, 12)}).\n`)
    return
  }
  if (!has('--confirm-rights')) throw new Error('Confirm you can redistribute these files with --confirm-rights.')
  const form = new FormData()
  for (const file of skill.files) form.append('file', new Blob([file.bytes]), path.basename(file.path))
  form.set('paths', JSON.stringify(skill.files.map((file) => file.path)))
  form.set('folderName', skill.name)
  form.set('rightsConfirmed', 'true')
  form.set('changelog', option('--changelog') || '')
  const result = await requestJson(`${base}/api/awesome/skills/hub`, { method: 'POST', headers, body: form })
  process.stdout.write(`${skill.name}: ${result.unchanged ? 'unchanged' : 'submitted'} ${result.version} (${result.status}) · ${base}/awesome/skills/hub\n`)
}

async function main() {
  if (!target || !['push', 'sync', 'download'].includes(command) || has('--help')) {
    process.stdout.write(usage)
    process.exitCode = 1
    return
  }
  const base = registryUrl()
  if (command === 'download') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)) throw new Error('Invalid Skill slug.')
    const version = option('--version')
    if (version && !/^1\.0\.\d{1,6}$/.test(version)) throw new Error('Invalid version.')
    const endpoint = `${base}/api/awesome/skills/hub/${encodeURIComponent(target)}/download${version ? `?version=${version}` : ''}`
    const response = await fetch(endpoint, { headers: process.env.LOGWOOD_SKILLHUB_TOKEN ? authHeaders() : undefined })
    if (!response.ok) throw new Error(`Download failed (${response.status}).`)
    const archive = Buffer.from(await response.arrayBuffer())
    const expectedHash = response.headers.get('x-skill-archive-sha256')
    if (!expectedHash || createHash('sha256').update(archive).digest('hex') !== expectedHash) {
      throw new Error('Archive checksum mismatch; the file was not saved.')
    }
    const output = path.resolve(option('--output') || `${target}-${version || 'latest'}.zip`)
    await writeFile(output, archive, { flag: 'wx' })
    process.stdout.write(`Saved ${output} (SHA-256 ${expectedHash}). Nothing was installed or executed.\n`)
    return
  }
  if (command === 'push') return submit(target, base, true)
  if (!has('--all')) return submit(target, base, false)
  const folders = await readdir(target, { withFileTypes: true })
  for (const folder of folders.filter((item) => item.isDirectory() && !item.name.startsWith('.'))) {
    const directory = path.join(target, folder.name)
    const entries = await readdir(directory)
    if (entries.includes('SKILL.md')) await submit(directory, base, false)
  }
}

main().catch((error) => {
  process.stderr.write(`Skill Hub: ${error instanceof Error ? error.message : 'unexpected error'}\n`)
  process.exitCode = 1
})
