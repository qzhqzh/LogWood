import { describe, expect, it, vi } from 'vitest'
import {
  AgentReplySourceType,
  AgentReplyTaskStatus,
} from '@prisma/client'
import { enqueueAgentReplyTask } from './enqueue'

function createTx(completedRounds = 0) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'owner-1' }]),
    agentReplyTask: {
      count: vi.fn().mockResolvedValue(completedRounds),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
        id: 'task-1',
        ...data,
      })),
    },
  }
}

describe('agent-reply/enqueue', () => {
  it('queues an external direct reply with a deterministic route', async () => {
    const tx = createTx()
    const result = await enqueueAgentReplyTask(tx as never, {
      ownerUserId: 'owner-1',
      commentId: 'comment-1',
      commentUserId: 'visitor-1',
      content: '这个 API 的幂等事务怎么做？',
      threadKey: 'comment-1',
      sourceType: AgentReplySourceType.review,
      isDirectReply: true,
      parentIsOwnedAiReply: false,
    })

    expect(result?.status).toBe(AgentReplyTaskStatus.pending)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.agentReplyTask.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            status: expect.objectContaining({
              in: expect.arrayContaining([AgentReplyTaskStatus.failed]),
            }),
          }),
          {
            status: AgentReplyTaskStatus.ignored,
            attempts: { gt: 0 },
          },
        ]),
      }),
    })
    expect(tx.agentReplyTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewCommentId: 'comment-1',
        selectedAgentIds: ['qwen_worker'],
      }),
    })
  })

  it('counts scheduled tasks and does not dispatch a fourth automated round', async () => {
    const tx = createTx(3)
    const result = await enqueueAgentReplyTask(tx as never, {
      ownerUserId: 'owner-1',
      commentId: 'comment-4',
      commentUserId: 'visitor-1',
      content: '继续说下去',
      threadKey: 'thread-1',
      sourceType: AgentReplySourceType.article,
      isDirectReply: false,
      parentIsOwnedAiReply: true,
    })

    expect(result?.status).toBe(AgentReplyTaskStatus.ignored)
    expect(result?.lastError).toBe('MAX_AUTOMATED_ROUNDS')
  })

  it('does not answer the AI owner or unrelated user-to-user replies', async () => {
    const tx = createTx()
    await expect(enqueueAgentReplyTask(tx as never, {
      ownerUserId: 'owner-1',
      commentId: 'comment-1',
      commentUserId: 'owner-1',
      content: '作者自己的补充',
      threadKey: 'comment-1',
      sourceType: AgentReplySourceType.review,
      isDirectReply: true,
      parentIsOwnedAiReply: false,
    })).resolves.toBeNull()
    await expect(enqueueAgentReplyTask(tx as never, {
      ownerUserId: 'owner-1',
      commentId: 'comment-2',
      commentUserId: null,
      content: '匿名评论不触发付费回复',
      threadKey: 'comment-2',
      sourceType: AgentReplySourceType.review,
      isDirectReply: true,
      parentIsOwnedAiReply: false,
    })).resolves.toBeNull()
    expect(tx.agentReplyTask.count).not.toHaveBeenCalled()
  })
})
