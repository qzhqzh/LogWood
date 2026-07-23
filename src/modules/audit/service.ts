/**
 * Admin audit log writes.
 *
 * Why this exists: destructive admin actions (delete an article, hide a
 * comment, change a target's slug) used to leave no trace beyond
 * `console.error` lines. After-the-fact forensics — "who hid this comment
 * and when?" — were impossible. The `AdminAuditLog` table fixes that.
 *
 * Append-only by convention: nothing in the app updates a log row. Retention
 * is the operator's choice (a future cron can prune by `createdAt`).
 */
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export type AuditTargetType =
  | 'article'
  | 'article_comment'
  | 'comment'
  | 'review'
  | 'evaluation'
  | 'target'
  | 'app'
  | 'tag'
  | 'emoji'

export interface RecordAdminActionInput {
  actorUserId: string
  action: string
  targetType: AuditTargetType
  targetId: string
  metadata?: Record<string, unknown>
}

/**
 * Record a destructive or state-changing admin action. Failures here are
 * logged but never thrown: the user-visible action (e.g. "delete article")
 * has already happened by the time we audit, and we don't want a bad audit
 * write to mask the success of the actual operation.
 */
export async function recordAdminAction(input: RecordAdminActionInput): Promise<void> {
  try {
    await (prisma as any).adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    })
  } catch (error) {
    logger.error('audit.write_failed', {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      err: error instanceof Error ? error.message : String(error),
    })
  }
}
