import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { AgentSkillReleaseStatus, Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SkillHubError, type SkillBundle } from './bundle'

const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000

export async function hubActor(request: Request) {
  const authorization = request.headers.get('authorization')
  if (authorization !== null) {
    const match = authorization.match(/^Bearer (lwsh_[a-zA-Z0-9_-]{32,})$/)
    if (!match) return null
    const tokenHash = createHash('sha256').update(match[1]).digest('hex')
    const token = await prisma.agentSkillPublishToken.findUnique({
      where: { tokenHash },
      select: { userId: true, expiresAt: true, revokedAt: true },
    })
    if (!token || token.revokedAt || token.expiresAt <= new Date()) return null
    return { userId: token.userId, admin: false }
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return { userId: session.user.id, admin: session.user.role === 'admin' }
}

export async function createHubToken(userId: string, label: string) {
  const name = label.trim()
  if (!name || name.length > 64) throw new SkillHubError('ERR_SKILL_HUB_TOKEN_LABEL')
  const now = new Date()
  const active = await prisma.agentSkillPublishToken.count({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
  })
  if (active >= 5) throw new SkillHubError('ERR_SKILL_HUB_TOKEN_LIMIT', 409)
  const token = `lwsh_${randomBytes(32).toString('base64url')}`
  const row = await prisma.agentSkillPublishToken.create({
    data: {
      userId,
      label: name,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
    },
    select: { id: true, label: true, expiresAt: true },
  })
  return { token, ...row }
}

export async function listHubTokens(userId: string) {
  return prisma.agentSkillPublishToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, label: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function revokeHubToken(userId: string, id: string) {
  const result = await prisma.agentSkillPublishToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count !== 1) throw new SkillHubError('ERR_SKILL_HUB_NOT_FOUND', 404)
}

const releaseSummary = {
  id: true, version: true, description: true, license: true,
  status: true, sourceHash: true, archiveHash: true,
  archiveSize: true, fileManifest: true, changelog: true, reviewNote: true,
  createdAt: true, publishedAt: true,
} as const

const publicReleaseSummary = {
  version: true, archiveHash: true, fileManifest: true,
} as const

export async function listPublishedHubSkills() {
  return prisma.agentSkillPackage.findMany({
    where: { releases: { some: { status: AgentSkillReleaseStatus.published } } },
    select: {
      slug: true, name: true, description: true, license: true, updatedAt: true,
      owner: { select: { name: true } },
      releases: {
        where: { status: AgentSkillReleaseStatus.published },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: publicReleaseSummary,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
}

export async function listMyHubSkills(userId: string) {
  return prisma.agentSkillPackage.findMany({
    where: { ownerUserId: userId },
    select: {
      slug: true, name: true, description: true, license: true,
      releases: { orderBy: { createdAt: 'desc' }, take: 5, select: releaseSummary },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
}

export async function listPendingHubSkills() {
  const rows = await prisma.agentSkillRelease.findMany({
    where: { status: AgentSkillReleaseStatus.pending },
    select: {
      ...releaseSummary, instructions: true,
      package: {
        select: { slug: true, name: true, description: true, license: true, owner: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 30,
  })
  return rows.map((row) => ({
    ...row,
    instructions: row.instructions.length > 12_000
      ? `${row.instructions.slice(0, 12_000)}\n\n[预览已截断，请下载待审 ZIP 检查完整文件]`
      : row.instructions,
  }))
}

function nextVersion(versions: string[]) {
  if (!versions.length) return '1.0.0'
  const patches = versions.map((version) => Number(version.split('.')[2]))
  return `1.0.${Math.max(...patches) + 1}`
}

export async function submitHubSkill(userId: string, bundle: SkillBundle, changelog: string) {
  if (changelog.length > 1000) throw new SkillHubError('ERR_SKILL_HUB_CHANGELOG')
  try {
    return await prisma.$transaction(async (tx) => {
      const queued = await tx.agentSkillRelease.count({
        where: { submitterUserId: userId, status: AgentSkillReleaseStatus.pending },
      })
      if (queued >= 10) throw new SkillHubError('ERR_SKILL_HUB_QUEUE_LIMIT', 429)
      const skill = await tx.agentSkillPackage.upsert({
        where: { ownerUserId_name: { ownerUserId: userId, name: bundle.name } },
        create: {
          slug: `${bundle.name}-${randomUUID().slice(0, 12)}`,
          name: bundle.name,
          description: bundle.description,
          license: bundle.license,
          ownerUserId: userId,
        },
        update: {},
        select: { id: true, slug: true },
      })
      const releases = await tx.agentSkillRelease.findMany({
        where: { packageId: skill.id },
        select: { id: true, status: true, version: true, sourceHash: true },
        orderBy: { createdAt: 'desc' },
      })
      const pending = releases.find((release) => release.status === AgentSkillReleaseStatus.pending)
      if (pending) {
        if (pending.sourceHash === bundle.sourceHash) {
          return { slug: skill.slug, version: pending.version, status: 'pending', unchanged: true }
        }
        throw new SkillHubError('ERR_SKILL_HUB_PENDING', 409)
      }
      const latestPublished = releases.find((release) => release.status === AgentSkillReleaseStatus.published)
      if (latestPublished?.sourceHash === bundle.sourceHash) {
        return { slug: skill.slug, version: latestPublished.version, status: 'published', unchanged: true }
      }
      if (releases.some((release) => release.status === AgentSkillReleaseStatus.rejected
        && release.sourceHash === bundle.sourceHash)) {
        throw new SkillHubError('ERR_SKILL_HUB_REJECTED', 409)
      }
      const version = nextVersion(releases.map((release) => release.version))
      await tx.agentSkillRelease.create({
        data: {
          packageId: skill.id,
          submitterUserId: userId,
          version,
          description: bundle.description,
          license: bundle.license,
          status: AgentSkillReleaseStatus.pending,
          sourceHash: bundle.sourceHash,
          archiveHash: bundle.archiveHash,
          archive: Uint8Array.from(bundle.archive),
          archiveSize: bundle.archive.length,
          fileManifest: bundle.fileManifest,
          instructions: bundle.instructions,
          changelog: changelog.trim() || null,
        },
      })
      return { slug: skill.slug, version, status: 'pending', unchanged: false }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new SkillHubError('ERR_SKILL_HUB_CONFLICT', 409)
    }
    throw error
  }
}

export async function reviewHubSkill(id: string, reviewerUserId: string, approve: boolean, note: string) {
  if (note.length > 1000) throw new SkillHubError('ERR_SKILL_HUB_REVIEW_NOTE')
  const reviewed = await prisma.$transaction(async (tx) => {
    const result = await tx.agentSkillRelease.updateMany({
      where: { id, status: AgentSkillReleaseStatus.pending },
      data: {
        status: approve ? AgentSkillReleaseStatus.published : AgentSkillReleaseStatus.rejected,
        reviewerUserId,
        reviewNote: note.trim() || null,
        publishedAt: approve ? new Date() : null,
      },
    })
    if (result.count !== 1) throw new SkillHubError('ERR_SKILL_HUB_CONFLICT', 409)
    const release = await tx.agentSkillRelease.findUniqueOrThrow({
      where: { id }, select: { packageId: true, status: true, description: true, license: true },
    })
    if (approve) {
      await tx.agentSkillPackage.update({
        where: { id: release.packageId },
        data: { updatedAt: new Date(), description: release.description, license: release.license },
      })
    }
    return release
  })
  return reviewed
}

export async function findHubDownload(slug: string, version: string | null, actor: { userId: string; admin: boolean } | null) {
  const skill = await prisma.agentSkillPackage.findUnique({
    where: { slug },
    select: { id: true, ownerUserId: true, name: true },
  })
  if (!skill) throw new SkillHubError('ERR_SKILL_HUB_NOT_FOUND', 404)
  const canReadPrivate = Boolean(actor?.admin || actor?.userId === skill.ownerUserId)
  const release = await prisma.agentSkillRelease.findFirst({
    where: {
      packageId: skill.id,
      ...(version ? { version } : {}),
      ...(!version || !canReadPrivate ? { status: AgentSkillReleaseStatus.published } : {}),
    },
    select: { archive: true, archiveHash: true, status: true, version: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })
  if (!release) throw new SkillHubError('ERR_SKILL_HUB_NOT_FOUND', 404)
  const archive = Buffer.from(release.archive)
  if (createHash('sha256').update(archive).digest('hex') !== release.archiveHash) {
    throw new SkillHubError('ERR_SKILL_HUB_INTEGRITY', 503)
  }
  return { name: skill.name, version: release.version, archive, archiveHash: release.archiveHash,
    public: release.status === AgentSkillReleaseStatus.published }
}
