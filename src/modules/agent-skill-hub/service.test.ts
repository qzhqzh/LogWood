import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  agentSkillPackage: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  agentSkillRelease: { count: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn() },
  agentSkillPublishToken: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn(),
}))
const sessionMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))

import { buildSkillBundle } from './bundle'
import { createHubToken, findHubDownload, hubActor, reviewHubSkill, submitHubSkill } from './service'

const skill = buildSkillBundle([{
  path: 'SKILL.md', bytes: Buffer.from('---\nname: test-skill\ndescription: A useful test skill for articles.\n---\nRead this.') ,
}], 'test-skill')

describe('Skill Hub publish and access', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock))
    prismaMock.agentSkillRelease.count.mockResolvedValue(0)
    prismaMock.agentSkillPackage.upsert.mockResolvedValue({ id: 'package-1', slug: 'test-skill-abc' })
    prismaMock.agentSkillRelease.findMany.mockResolvedValue([])
    prismaMock.agentSkillRelease.create.mockResolvedValue({ id: 'release-1' })
    prismaMock.agentSkillPackage.update.mockResolvedValue({})
  })

  it('persists an immutable pending version and skips unchanged submissions', async () => {
    expect(await submitHubSkill('author-1', skill, 'first version')).toMatchObject({
      slug: 'test-skill-abc', version: '1.0.0', status: 'pending', unchanged: false,
    })
    expect(prismaMock.agentSkillRelease.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'pending', sourceHash: skill.sourceHash,
        archive: expect.any(Uint8Array), submitterUserId: 'author-1',
        description: skill.description }),
    })
    expect(prismaMock.agentSkillPackage.update).not.toHaveBeenCalled()
    prismaMock.agentSkillRelease.findMany.mockResolvedValue([{
      id: 'release-1', status: 'pending', version: '1.0.0', sourceHash: skill.sourceHash,
    }])
    expect(await submitHubSkill('author-1', skill, '')).toMatchObject({ unchanged: true })
    expect(prismaMock.agentSkillRelease.create).toHaveBeenCalledTimes(1)
  })

  it('rejects unchanged resubmission of a rejected release and user queue floods', async () => {
    prismaMock.agentSkillRelease.findMany.mockResolvedValue([{
      id: 'release-1', status: 'rejected', version: '1.0.0', sourceHash: skill.sourceHash,
    }])
    await expect(submitHubSkill('author-1', skill, '')).rejects.toThrow('ERR_SKILL_HUB_REJECTED')
    prismaMock.agentSkillRelease.count.mockResolvedValue(10)
    await expect(submitHubSkill('author-1', skill, '')).rejects.toThrow('ERR_SKILL_HUB_QUEUE_LIMIT')
  })

  it('makes pending downloads owner-only and verifies the stored archive hash', async () => {
    prismaMock.agentSkillPackage.findUnique.mockResolvedValue({ id: 'package-1', ownerUserId: 'author-1', name: 'test-skill' })
    prismaMock.agentSkillRelease.findFirst.mockResolvedValue(null)
    await expect(findHubDownload('test-skill-abc', '1.0.0', null))
      .rejects.toThrow('ERR_SKILL_HUB_NOT_FOUND')
    expect(prismaMock.agentSkillRelease.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { packageId: 'package-1', version: '1.0.0', status: 'published' },
    }))
    prismaMock.agentSkillRelease.findFirst.mockResolvedValue({
      status: 'pending', version: '1.0.0', archive: skill.archive,
      archiveHash: skill.archiveHash,
    })
    const own = await findHubDownload('test-skill-abc', '1.0.0', { userId: 'author-1', admin: false })
    expect(own.archiveHash).toBe(skill.archiveHash)
    expect(prismaMock.agentSkillRelease.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { packageId: 'package-1', version: '1.0.0' },
    }))
  })

  it('approves once, and hashes one-time tokens instead of storing them in plaintext', async () => {
    prismaMock.agentSkillRelease.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.agentSkillRelease.findUniqueOrThrow.mockResolvedValue({
      packageId: 'package-1', status: 'published', description: skill.description, license: skill.license,
    })
    expect(await reviewHubSkill('release-1', 'admin-1', true, 'checked')).toMatchObject({ packageId: 'package-1', status: 'published' })
    expect(prismaMock.agentSkillRelease.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'release-1', status: 'pending' },
    }))
    expect(prismaMock.agentSkillPackage.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ description: skill.description, license: skill.license }),
    }))
    prismaMock.agentSkillPublishToken.count.mockResolvedValue(0)
    prismaMock.agentSkillPublishToken.create.mockImplementation(async ({ data }) => ({ id: 'token-1', label: data.label, expiresAt: data.expiresAt }))
    const issued = await createHubToken('author-1', 'laptop')
    const saved = prismaMock.agentSkillPublishToken.create.mock.calls[0][0].data
    expect(saved.tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'))
    expect(JSON.stringify(saved)).not.toContain(issued.token)
    prismaMock.agentSkillPublishToken.findUnique.mockResolvedValue({ userId: 'author-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) })
    expect(await hubActor(new Request('http://localhost/api', { headers: { Authorization: `Bearer ${issued.token}` } })))
      .toEqual({ userId: 'author-1', admin: false })
    expect(sessionMock).not.toHaveBeenCalled()
  })
})
