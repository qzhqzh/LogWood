import { prisma } from '@/lib/prisma'
import { RateLimitAction, ActorType } from '@prisma/client'
import { ActorContext } from '@/modules/identity'

interface RateLimitConfig {
  maxCount: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'review_create:user': { maxCount: 10 },
  'review_create:anonymous': { maxCount: 5 },
  'comment_create:user': { maxCount: 30 },
  'comment_create:anonymous': { maxCount: 20 },
  'like_create:user': { maxCount: 50 },
  'like_create:anonymous': { maxCount: 30 },
  'report_create:user': { maxCount: 20 },
  'report_create:anonymous': { maxCount: 10 },
  'like_create:ip_segment': { maxCount: 200 },
}

function getWindowDate(): Date {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return new Date(
    Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate())
  )
}

function getActorKeyForLimit(actor: ActorContext, actorType: ActorType): string {
  if (actorType === 'ip_segment' && actor.ipHash) {
    return actor.ipHash
  }
  return actor.actorKey
}

export async function checkAndConsume(
  action: RateLimitAction,
  actor: ActorContext,
  amount: number = 1
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const windowDate = getWindowDate()
  const resetAt = new Date(windowDate.getTime() + 24 * 60 * 60 * 1000)

  const userKey = `${action}:${actor.actorType}`
  const config = RATE_LIMITS[userKey]

  if (!config) {
    return { allowed: true, remaining: Infinity, resetAt }
  }

  const actorKey = getActorKeyForLimit(actor, actor.actorType as ActorType)

  const existing = await prisma.rateLimit.findUnique({
    where: {
      action_actorType_actorKey_windowDate: {
        action,
        actorType: actor.actorType as ActorType,
        actorKey,
        windowDate,
      },
    },
  })

  if (existing) {
    if (existing.count + amount > config.maxCount) {
      return { allowed: false, remaining: 0, resetAt }
    }

    const updated = await prisma.rateLimit.update({
      where: { id: existing.id },
      data: { count: { increment: amount } },
    })

    return {
      allowed: true,
      remaining: config.maxCount - updated.count,
      resetAt,
    }
  }

  await prisma.rateLimit.create({
    data: {
      action,
      actorType: actor.actorType as ActorType,
      actorKey,
      windowDate,
      count: amount,
    },
  })

  return {
    allowed: true,
    remaining: config.maxCount - amount,
    resetAt,
  }
}

export async function getRemainingQuota(
  action: RateLimitAction,
  actor: ActorContext
): Promise<{ remaining: number; resetAt: Date }> {
  const windowDate = getWindowDate()
  const resetAt = new Date(windowDate.getTime() + 24 * 60 * 60 * 1000)

  const userKey = `${action}:${actor.actorType}`
  const config = RATE_LIMITS[userKey]

  if (!config) {
    return { remaining: Infinity, resetAt }
  }

  const actorKey = getActorKeyForLimit(actor, actor.actorType as ActorType)

  const existing = await prisma.rateLimit.findUnique({
    where: {
      action_actorType_actorKey_windowDate: {
        action,
        actorType: actor.actorType as ActorType,
        actorKey,
        windowDate,
      },
    },
  })

  if (!existing) {
    return { remaining: config.maxCount, resetAt }
  }

  return {
    remaining: Math.max(0, config.maxCount - existing.count),
    resetAt,
  }
}

export async function checkIpSegmentLimit(
  action: RateLimitAction,
  actor: ActorContext
): Promise<{ allowed: boolean; remaining: number }> {
  if (!actor.ipHash) {
    return { allowed: true, remaining: Infinity }
  }

  const windowDate = getWindowDate()
  const config = RATE_LIMITS[`${action}:ip_segment`]

  if (!config) {
    return { allowed: true, remaining: Infinity }
  }

  const existing = await prisma.rateLimit.findUnique({
    where: {
      action_actorType_actorKey_windowDate: {
        action,
        actorType: 'ip_segment',
        actorKey: actor.ipHash,
        windowDate,
      },
    },
  })

  if (!existing) {
    return { allowed: true, remaining: config.maxCount }
  }

  return {
    allowed: existing.count < config.maxCount,
    remaining: Math.max(0, config.maxCount - existing.count),
  }
}
