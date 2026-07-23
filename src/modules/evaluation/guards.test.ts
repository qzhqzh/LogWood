import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    evaluation: { count: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { assertNoEvaluationsForSubject } from './guards'

const countMock = vi.mocked(prisma.evaluation.count)

describe('assertNoEvaluationsForSubject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows deletion when no formal Evaluation references the subject', async () => {
    countMock.mockResolvedValue(0)
    await expect(assertNoEvaluationsForSubject('skill', 's1')).resolves.toBeUndefined()
    expect(countMock).toHaveBeenCalledWith({ where: { skillId: 's1' } })
  })

  it('blocks deletion when formal Evaluation evidence exists', async () => {
    countMock.mockResolvedValue(2)
    await expect(assertNoEvaluationsForSubject('target', 't1')).rejects.toThrow('ERR_SUBJECT_HAS_EVALUATIONS')
    expect(countMock).toHaveBeenCalledWith({ where: { targetId: 't1' } })
  })
})
