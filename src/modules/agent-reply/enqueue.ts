import {
  AgentReplySourceType,
  AgentReplyTaskStatus,
  CommentStatus,
  Prisma,
} from '@prisma/client'
import { recommendReplyRoute } from './policy'

const MAX_AUTOMATED_ROUNDS = 3

interface EnqueueInput {
  ownerUserId: string
  commentId: string
  commentUserId?: string | null
  content: string
  threadKey: string
  sourceType: AgentReplySourceType
  isDirectReply: boolean
  parentIsOwnedAiReply: boolean
}

export async function enqueueAgentReplyTask(
  tx: Prisma.TransactionClient,
  input: EnqueueInput,
) {
  if (
    input.commentUserId === input.ownerUserId
    || (!input.isDirectReply && !input.parentIsOwnedAiReply)
  ) {
    return null
  }

  const route = recommendReplyRoute(input.content)
  const completedRounds = await tx.agentReplyTask.count({
    where: {
      ownerUserId: input.ownerUserId,
      threadKey: input.threadKey,
      status: AgentReplyTaskStatus.replied,
    },
  })
  const exceededRoundLimit = completedRounds >= MAX_AUTOMATED_ROUNDS
  const terminalByPolicy = route.strategy === 'ignore' || route.strategy === 'escalate'
  const status = exceededRoundLimit || terminalByPolicy
    ? AgentReplyTaskStatus.ignored
    : AgentReplyTaskStatus.pending

  return tx.agentReplyTask.create({
    data: {
      ownerUserId: input.ownerUserId,
      sourceType: input.sourceType,
      reviewCommentId: input.sourceType === AgentReplySourceType.review
        ? input.commentId
        : undefined,
      articleCommentId: input.sourceType === AgentReplySourceType.article
        ? input.commentId
        : undefined,
      threadKey: input.threadKey,
      status,
      attitude: route.attitude,
      strategy: route.strategy,
      priority: route.priority,
      selectedAgentIds: route.selectedAgentIds,
      completedAt: status === AgentReplyTaskStatus.ignored ? new Date() : undefined,
      lastError: exceededRoundLimit ? 'MAX_AUTOMATED_ROUNDS' : route.policyReason,
    },
  })
}

export function shouldQueuePublishedComment(status: CommentStatus, hasAiOwner: boolean) {
  return status === CommentStatus.published && hasAiOwner
}
