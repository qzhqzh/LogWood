import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const mock = {
    evaluation: { count: vi.fn() },
    review: { count: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  }
  mock.$transaction.mockImplementation((callback) => callback(mock))
  return mock
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { prisma } from '@/lib/prisma'
import {
  assertNoEvaluationsForSubject,
  assertNoHistoryForSubject,
  deleteSubjectWithHistoryGuard,
} from './guards'

const countMock = vi.mocked(prisma.evaluation.count)
const reviewCountMock = vi.mocked(prisma.review.count)

describe('assertNoEvaluationsForSubject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countMock.mockResolvedValue(0)
    reviewCountMock.mockResolvedValue(0)
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'subject-1' }])
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock))
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

describe('assertNoHistoryForSubject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countMock.mockResolvedValue(0)
    reviewCountMock.mockResolvedValue(0)
  })

  it('blocks physical deletion when free-form history exists', async () => {
    reviewCountMock.mockResolvedValue(1)

    await expect(assertNoHistoryForSubject('candidate', 'c1')).rejects.toThrow('ERR_SUBJECT_HAS_HISTORY')
    expect(reviewCountMock).toHaveBeenCalledWith({ where: { candidateId: 'c1' } })
  })

  it('allows deletion only when no Evaluation or Review exists', async () => {
    await expect(assertNoHistoryForSubject('app', 'a1')).resolves.toBeUndefined()
  })

  it('locks the subject and checks history before running the delete callback', async () => {
    const deleteSubject = vi.fn().mockResolvedValue({ id: 'c1' })

    await expect(deleteSubjectWithHistoryGuard('candidate', 'c1', deleteSubject))
      .resolves.toEqual({ id: 'c1' })

    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce()
    expect(countMock).toHaveBeenCalledWith({ where: { candidateId: 'c1' } })
    expect(reviewCountMock).toHaveBeenCalledWith({ where: { candidateId: 'c1' } })
    expect(deleteSubject).toHaveBeenCalledWith(prismaMock)
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0])
      .toBeLessThan(deleteSubject.mock.invocationCallOrder[0])
  })
})
