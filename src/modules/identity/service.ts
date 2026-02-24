import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type ActorType = 'user' | 'anonymous'

export interface ActorContext {
  actorType: ActorType
  userId?: string
  anonymousUserId?: string
  actorKey: string
  ipHash?: string
}

const ANONYMOUS_SEQUENCE_START = 9527

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

function getIpFromHeaders(headersList: Headers): string {
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return headersList.get('x-real-ip') || 'unknown'
}

export async function resolveActor(): Promise<ActorContext> {
  const session = await getServerSession(authOptions)
  const headersList = headers()
  const ip = getIpFromHeaders(headersList)
  const ipHash = hashString(ip)

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

export async function ensureAnonymous(deviceFingerprint: string): Promise<{
  id: string
  displayName: string
  isNew: boolean
}> {
  if (!deviceFingerprint || deviceFingerprint.length < 10) {
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

  const lastUser = await prisma.anonymousUser.findFirst({
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  })

  const nextSequence = lastUser
    ? lastUser.sequenceNumber + 1
    : ANONYMOUS_SEQUENCE_START

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
}

export async function resolveActorWithFingerprint(
  deviceFingerprint?: string
): Promise<ActorContext> {
  const baseActor = await resolveActor()

  if (baseActor.actorType === 'user') {
    return baseActor
  }

  if (!deviceFingerprint) {
    return baseActor
  }

  const anonymousUser = await ensureAnonymous(deviceFingerprint)

  return {
    ...baseActor,
    anonymousUserId: anonymousUser.id,
    actorKey: `anonymous:${anonymousUser.id}`,
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
