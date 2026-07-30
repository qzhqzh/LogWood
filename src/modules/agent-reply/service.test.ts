import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentReplyTaskStatus } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  agentReplyTask: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  agentReplyContribution: {
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  claimReplyTasks,
  finalizeReplyTask,
  planReplyTask,
  recordReplyTaskFailure,
} from './service'

describe('agent-reply/service leases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records a process-level lease owner when claiming work', async () => {
    prismaMock.agentReplyTask.findMany
      .mockResolvedValueOnce([{ id: 'task-1' }])
      .mockResolvedValueOnce([{ id: 'task-1', leaseOwner: 'worker:a1' }])
    prismaMock.agentReplyTask.updateMany.mockResolvedValue({ count: 1 })

    await claimReplyTasks({
      ownerUserId: 'owner-1',
      coordinatorAgentId: 'totemora-coordinator',
      leaseOwner: 'worker:a1',
    })

    expect(prismaMock.agentReplyTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coordinatorAgentId: 'totemora-coordinator',
          leaseOwner: 'worker:a1',
        }),
      }),
    )
  })

  it('rejects a stale worker before changing the reply plan', async () => {
    prismaMock.agentReplyTask.findFirst.mockResolvedValue({
      id: 'task-1',
      coordinatorAgentId: 'totemora-coordinator',
      leaseOwner: 'worker:new',
    })

    await expect(planReplyTask({
      taskId: 'task-1',
      ownerUserId: 'owner-1',
      coordinatorAgentId: 'totemora-coordinator',
      leaseOwner: 'worker:old',
      selectedAgentIds: ['qwen_worker'],
    })).rejects.toThrow('ERR_REPLY_TASK_LEASED')
    expect(prismaMock.agentReplyTask.updateMany).not.toHaveBeenCalled()
  })

  it('guards failure recovery with the observed lease and attempt count', async () => {
    prismaMock.agentReplyTask.findFirst.mockResolvedValue({
      id: 'task-1',
      attempts: 2,
    })
    prismaMock.agentReplyTask.updateMany.mockResolvedValue({ count: 0 })

    await recordReplyTaskFailure({
      taskId: 'task-1',
      ownerUserId: 'owner-1',
      coordinatorAgentId: 'totemora-coordinator',
      leaseOwner: 'worker:old',
      error: new Error('ERR_TOTEMORA_CHAT_FAILED'),
    })

    expect(prismaMock.agentReplyTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coordinatorAgentId: 'totemora-coordinator',
          leaseOwner: 'worker:old',
          attempts: 2,
        }),
      }),
    )
  })

  it('rejects finalization after another worker has acquired the lease', async () => {
    const transactionTask = {
      agentReplyTask: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-1',
          status: AgentReplyTaskStatus.claimed,
          coordinatorAgentId: 'totemora-coordinator',
          leaseOwner: 'worker:new',
          selectedAgentIds: ['qwen_worker'],
          reviewComment: {
            id: 'comment-1',
            reviewId: 'review-1',
          },
          articleComment: null,
        }),
        updateMany: vi.fn(),
      },
    }
    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof transactionTask) => unknown) => callback(transactionTask),
    )

    await expect(finalizeReplyTask({
      taskId: 'task-1',
      ownerUserId: 'owner-1',
      coordinatorAgentId: 'totemora-coordinator',
      leaseOwner: 'worker:old',
      replyAgentId: 'qwen_worker',
      content: '这是一条最终回复。',
      aiAttribution: {
        provider: 'qwen',
        model: 'qwen3.7-plus',
        modelVersion: 'member-v2',
      },
    })).rejects.toThrow('ERR_REPLY_TASK_LEASED')
    expect(transactionTask.agentReplyTask.updateMany).not.toHaveBeenCalled()
  })
})
