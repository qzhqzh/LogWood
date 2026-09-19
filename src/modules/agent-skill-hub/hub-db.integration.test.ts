import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { buildSkillBundle } from './bundle'
import {
  createHubToken, findHubDownload, hubActor, listPublishedHubSkills,
  reviewHubSkill, revokeHubToken, submitHubSkill,
} from './service'

const integrationUrl = process.env.SKILLHUB_INTEGRATION_URL
const isIsolatedDatabase = Boolean(integrationUrl && integrationUrl === process.env.DATABASE_URL
  && new URL(integrationUrl).hostname === '127.0.0.1'
  && new URL(integrationUrl).pathname.endsWith('_temp'))
const integrationOrigin = process.env.SKILLHUB_INTEGRATION_ORIGIN
const canTestCli = isIsolatedDatabase && Boolean(integrationOrigin
  && new URL(integrationOrigin).hostname === '127.0.0.1'
  && new URL(integrationOrigin).protocol === 'http:')

function bundle(name: string, description: string) {
  return buildSkillBundle([{
    path: 'SKILL.md',
    bytes: Buffer.from(`---\nname: ${name}\ndescription: ${description}\nlicense: MIT\n---\n# ${name}\nRead this first.\n`),
  }], name)
}

describe('Skill Hub isolated database flow', () => {
  it.skipIf(!isIsolatedDatabase)('submits, reviews, versions, downloads, and revokes a publisher token', async () => {
    const suffix = randomUUID().slice(0, 12)
    const name = `db-skill-${suffix}`
    const [author, reviewer] = await Promise.all([
      prisma.user.create({ data: { email: `${suffix}-author@integration.test` } }),
      prisma.user.create({ data: { email: `${suffix}-reviewer@integration.test` } }),
    ])
    try {
      const first = bundle(name, 'First published description of this test skill.')
      const submitted = await submitHubSkill(author.id, first, 'First review')
      expect(submitted).toMatchObject({ version: '1.0.0', status: 'pending' })
      expect((await listPublishedHubSkills()).some((item) => item.slug === submitted.slug)).toBe(false)
      await expect(findHubDownload(submitted.slug, '1.0.0', null)).rejects.toThrow('ERR_SKILL_HUB_NOT_FOUND')
      expect((await findHubDownload(submitted.slug, '1.0.0', { userId: author.id, admin: false })).archiveHash)
        .toBe(first.archiveHash)

      const release = await prisma.agentSkillRelease.findFirstOrThrow({ where: { version: '1.0.0', package: { slug: submitted.slug } } })
      await reviewHubSkill(release.id, reviewer.id, true, 'Checked files and license')
      const listed = (await listPublishedHubSkills()).find((item) => item.slug === submitted.slug)
      expect(listed?.releases[0]?.version).toBe('1.0.0')
      expect(listed?.releases[0]).not.toHaveProperty('reviewNote')
      expect((await findHubDownload(submitted.slug, null, null)).archiveHash).toBe(first.archiveHash)
      expect((await submitHubSkill(author.id, first, 'No changes')).unchanged).toBe(true)

      const second = bundle(name, 'Second description is still awaiting human review.')
      expect((await submitHubSkill(author.id, second, 'Proposed change')).version).toBe('1.0.1')
      expect((await listPublishedHubSkills()).find((item) => item.slug === submitted.slug)?.description)
        .toBe(first.description)
      const pending = await prisma.agentSkillRelease.findFirstOrThrow({ where: { version: '1.0.1', package: { slug: submitted.slug } } })
      await reviewHubSkill(pending.id, reviewer.id, true, 'Approved update')
      expect((await listPublishedHubSkills()).find((item) => item.slug === submitted.slug)?.description)
        .toBe(second.description)
      expect((await findHubDownload(submitted.slug, '1.0.0', null)).archiveHash).toBe(first.archiveHash)

      const token = await createHubToken(author.id, 'integration test')
      const actor = await hubActor(new Request('http://localhost', { headers: { Authorization: `Bearer ${token.token}` } }))
      expect(actor).toEqual({ userId: author.id, admin: false })
      await revokeHubToken(author.id, token.id)
      expect(await hubActor(new Request('http://localhost', { headers: { Authorization: `Bearer ${token.token}` } })))
        .toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  it.skipIf(!canTestCli)('syncs and downloads through the standalone CLI against the isolated server', async () => {
    const suffix = randomUUID().slice(0, 12)
    const name = `cli-skill-${suffix}`
    const root = await mkdtemp(path.join(tmpdir(), 'logwood-skillhub-cli-'))
    try {
      const folder = path.join(root, name)
      await mkdir(path.join(folder, 'references'), { recursive: true })
      await writeFile(path.join(folder, 'SKILL.md'),
        `---\nname: ${name}\ndescription: A temporary CLI integration test.\nlicense: MIT\n---\n# CLI Test\n`)
      await writeFile(path.join(folder, 'references', 'notes.txt'), 'Uploaded via the standalone CLI.\n')
      const author = await prisma.user.create({ data: { email: `${suffix}-cli@integration.test` } })
      const reviewer = await prisma.user.create({ data: { email: `${suffix}-cli-reviewer@integration.test` } })
      const token = await createHubToken(author.id, 'CLI integration test')
      const env = {
        ...process.env,
        LOGWOOD_SKILLHUB_URL: integrationOrigin,
        LOGWOOD_SKILLHUB_TOKEN: token.token,
      }
      const runCli = (...args: string[]) => execFileSync(process.execPath,
        [path.join(process.cwd(), 'scripts/skillhub.mjs'), ...args], { env, encoding: 'utf8' })

      expect(runCli('sync', folder, '--confirm-rights')).toContain('submitted 1.0.0 (pending)')
      expect(runCli('sync', folder, '--confirm-rights')).toContain('unchanged, skipped')
      const skill = await prisma.agentSkillPackage.findFirstOrThrow({ where: { ownerUserId: author.id, name } })
      const release = await prisma.agentSkillRelease.findFirstOrThrow({ where: { packageId: skill.id, version: '1.0.0' } })
      await reviewHubSkill(release.id, reviewer.id, true, 'CLI fixture reviewed')

      const output = path.join(root, 'release.zip')
      const publicEnv = { ...env, LOGWOOD_SKILLHUB_TOKEN: '' }
      const downloaded = execFileSync(process.execPath,
        [path.join(process.cwd(), 'scripts/skillhub.mjs'), 'download', skill.slug,
          '--version', '1.0.0', '--output', output], { env: publicEnv, encoding: 'utf8' })
      expect(downloaded).toContain('Nothing was installed or executed')
      const entries = unzipSync(new Uint8Array(await readFile(output)))
      expect(Object.keys(entries).sort()).toEqual(['SKILL.md', 'references/notes.txt'])
      expect(Buffer.from(entries['references/notes.txt']).toString()).toContain('standalone CLI')
      await revokeHubToken(author.id, token.id)
    } finally {
      await rm(root, { recursive: true, force: true })
      await prisma.$disconnect()
    }
  })
})
