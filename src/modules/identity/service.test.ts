import { beforeEach, describe, expect, it, vi } from 'vitest'

// Order matters: vi.mock must be hoistable, so declare it before the import.
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: () => new Headers(),
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    anonymousUser: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { resolveActorWithFingerprint } from './service'

const sessionMock = getServerSession as unknown as ReturnType<typeof vi.fn>
const prismaMock = prisma as unknown as {
  anonymousUser: {
    findUnique: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

const VALID_FP = 'a'.repeat(20) // matches /^[A-Za-z0-9_-]{16,128}$/

describe('identity/resolveActorWithFingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockResolvedValue(null)
  })

  it('does NOT create an AnonymousUser by default (R-02)', async () => {
    prismaMock.anonymousUser.findUnique.mockResolvedValue(null)

    const actor = await resolveActorWithFingerprint(VALID_FP)

    expect(prismaMock.anonymousUser.create).not.toHaveBeenCalled()
    expect(actor.actorType).toBe('anonymous')
    // Still IP-keyed because we couldn't resolve to a known anon user.
    expect(actor.actorKey).toMatch(/^ip:/)
    expect(actor.anonymousUserId).toBeUndefined()
  })

  it('attaches an existing AnonymousUser without writing on read paths', async () => {
    prismaMock.anonymousUser.findUnique.mockResolvedValue({ id: 'anon-1' })

    const actor = await resolveActorWithFingerprint(VALID_FP)

    expect(prismaMock.anonymousUser.create).not.toHaveBeenCalled()
    expect(prismaMock.anonymousUser.update).not.toHaveBeenCalled()
    expect(actor.anonymousUserId).toBe('anon-1')
    expect(actor.actorKey).toBe('anonymous:anon-1')
  })

  it('creates an AnonymousUser only when createIfMissing is true', async () => {
    prismaMock.anonymousUser.findUnique
      // First call inside resolveActorWithFingerprint (read-only check)
      .mockResolvedValueOnce(null)
      // Second call inside ensureAnonymous (existence check before create)
      .mockResolvedValueOnce(null)
    prismaMock.anonymousUser.findFirst.mockResolvedValue({ sequenceNumber: 9527 })
    prismaMock.anonymousUser.create.mockResolvedValue({
      id: 'anon-new',
      displayName: '匿名#9528',
      sequenceNumber: 9528,
    })

    const actor = await resolveActorWithFingerprint(VALID_FP, { createIfMissing: true })

    expect(prismaMock.anonymousUser.create).toHaveBeenCalledTimes(1)
    expect(actor.anonymousUserId).toBe('anon-new')
    expect(actor.actorKey).toBe('anonymous:anon-new')
  })

  it('rejects malformed fingerprints (too short)', async () => {
    const actor = await resolveActorWithFingerprint('short', { createIfMissing: true })
    // Bad fingerprint -> base anonymous actor with no anon user attached.
    expect(prismaMock.anonymousUser.create).not.toHaveBeenCalled()
    expect(actor.anonymousUserId).toBeUndefined()
  })

  it('rejects fingerprints with invalid characters', async () => {
    const malicious = 'A'.repeat(20) + ';DROP TABLE--'
    const actor = await resolveActorWithFingerprint(malicious, { createIfMissing: true })
    expect(prismaMock.anonymousUser.create).not.toHaveBeenCalled()
    expect(actor.anonymousUserId).toBeUndefined()
  })

  it('returns user-scoped actor when session is authenticated', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-42' } })

    const actor = await resolveActorWithFingerprint(VALID_FP, { createIfMissing: true })

    expect(actor.actorType).toBe('user')
    expect(actor.userId).toBe('user-42')
    expect(prismaMock.anonymousUser.findUnique).not.toHaveBeenCalled()
  })
})
