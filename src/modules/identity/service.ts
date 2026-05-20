import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIp, hashIp } from '@/lib/ip'

export type ActorType = 'user' | 'anonymous'

export interface ActorContext {
  actorType: ActorType
  userId?: string
  anonymousUserId?: string
  actorKey: string
  ipHash?: string
}

const ANONYMOUS_SEQUENCE_START = 9527

/**
 * Accepted device fingerprint shape: 16-128 chars from a URL-safe alphabet.
 *
 * `crypto.randomUUID()` (the client default) maps to 36 chars and matches.
 * The cap (128) prevents abuse where a client tries to inflate a column or
 * push pathological keys into the rate-limit table.
 */
const FINGERPRINT_REGEX = /^[A-Za-z0-9_-]{16,128}$/

export interface ResolveActorOptions {
  /**
   * If `true` and the request carries an unseen fingerprint, a new
   * `AnonymousUser` row will be created. Default `false` so that GET handlers
   * never trigger anonymous-user creation just by being polled (R-02).
   * Write endpoints (POST/PATCH/DELETE that genuinely need to attribute
   * actions to an anonymous identity) should pass `true` explicitly.
   */
  createIfMissing?: boolean
}

export async function resolveActor(): Promise<ActorContext> {
  const session = await getServerSession(authOptions)
  const headersList = headers()
  const ip = getClientIp(headersList)
  const ipHash = hashIp(ip)

  if (session?.user?.id) {
    return {
      actorType: 'user',
      userId: session.user.id,
      actorKey: `user:${session.user.id}`,
      ipHash,
    }
  }

  return {
    actorType: 'anonymous',
    actorKey: `ip:${ipHash}`,
    ipHash,
  }
}

/**
 * Create or load an `AnonymousUser` row by fingerprint. **Only call this from
 * write/mutating flows** that legitimately need an anon identity to be
 * persisted. For read-only flows that just want "is this fingerprint already
 * known?" semantics, use `resolveActorWithFingerprint` with the default
 * `createIfMissing: false`.
 */
export async function ensureAnonymous(deviceFingerprint: string): Promise<{
  id: string
  displayName: string
  isNew: boolean
}> {
  if (!FINGERPRINT_REGEX.test(deviceFingerprint)) {
    throw new Error('ERR_DEVICE_FINGERPRINT_INVALID')
  }

  const existing = await prisma.anonymousUser.findUnique({
    where: { deviceFingerprint },
  })

  if (existing) {
    await prisma.anonymousUser.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    })
    return {
      id: existing.id,
      displayName: existing.displayName,
      isNew: false,
    }
  }

  // Concurrent creates can race here; if two requests arrive with a brand
  // new fingerprint at the same time, one will win the unique constraint and
  // the other should retry the find.
  const lastUser = await prisma.anonymousUser.findFirst({
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  })

  const nextSequence = lastUser
    ? lastUser.sequenceNumber + 1
    : ANONYMOUS_SEQUENCE_START

  try {
    const newUser = await prisma.anonymousUser.create({
      data: {
        deviceFingerprint,
        displayName: `匿名#${nextSequence}`,
        sequenceNumber: nextSequence,
      },
    })

    return {
      id: newUser.id,
      displayName: newUser.displayName,
      isNew: true,
    }
  } catch (error) {
    // Lost the race: another request just created this fingerprint. Reload.
    const racedExisting = await prisma.anonymousUser.findUnique({
      where: { deviceFingerprint },
    })
    if (racedExisting) {
      return {
        id: racedExisting.id,
        displayName: racedExisting.displayName,
        isNew: false,
      }
    }
    throw error
  }
}

export async function resolveActorWithFingerprint(
  deviceFingerprint?: string,
  options: ResolveActorOptions = {}
): Promise<ActorContext> {
  const { createIfMissing = false } = options
  const baseActor = await resolveActor()

  if (baseActor.actorType === 'user') {
    return baseActor
  }

  if (!deviceFingerprint || !FINGERPRINT_REGEX.test(deviceFingerprint)) {
    return baseActor
  }

  // Read-only path: load by fingerprint without writing. This avoids the
  // historical behaviour where a GET request silently inflated the
  // anonymous_users table for every fresh fingerprint a bot rotated.
  const existing = await prisma.anonymousUser.findUnique({
    where: { deviceFingerprint },
    select: { id: true },
  })

  if (existing) {
    return {
      ...baseActor,
      anonymousUserId: existing.id,
      actorKey: `anonymous:${existing.id}`,
    }
  }

  if (!createIfMissing) {
    // Unknown fingerprint and we're in a read-only context. Stay IP-keyed.
    return baseActor
  }

  const created = await ensureAnonymous(deviceFingerprint)
  return {
    ...baseActor,
    anonymousUserId: created.id,
    actorKey: `anonymous:${created.id}`,
  }
}

export async function getAnonymousUserById(id: string) {
  return prisma.anonymousUser.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      sequenceNumber: true,
      riskLevel: true,
    },
  })
}
