import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const mock = {
    candidate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    candidateInterest: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      upsert: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  mock.$transaction.mockImplementation((callback) => callback(mock))
  return mock
})

const checkAndConsumeMock = vi.hoisted(() => vi.fn())
const checkIpSegmentLimitMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/modules/rate-limit', () => ({
  checkAndConsume: checkAndConsumeMock,
  checkIpSegmentLimit: checkIpSegmentLimitMock,
}))

import {
  listAwesomeProjects,
  rankAwesomeProjects,
  setAwesomeInterest,
  type AwesomeProject,
} from './awesome'

function project(title: string, totalScore: number, sortOrder: number): AwesomeProject {
  return {
    id: title,
    title,
    slug: title.toLowerCase(),
    summary: title,
    websiteUrl: null,
    sourceUrl: null,
    status: 'watching',
    sortOrder,
    tags: [],
    dossier: {
      schema: 'awesome-project.v1',
      upstreamName: title,
      direction: 'prompt-quality',
      license: 'MIT',
      effort: '1 DAY',
      posture: 'STUDY',
      whyItMatters: 'why',
      buildProposal: 'build',
      firstMilestone: 'first',
      researchNote: 'note',
    },
    interest: {
      totalScore,
      averageScore: totalScore ? 5 : null,
      ratingCount: totalScore ? 1 : 0,
      myScore: null,
    },
  }
}

describe('candidate/awesome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock))
    prismaMock.candidate.findMany.mockResolvedValue([])
    prismaMock.candidateInterest.findMany.mockResolvedValue([])
    prismaMock.candidateInterest.groupBy.mockResolvedValue([])
    checkAndConsumeMock.mockResolvedValue({ allowed: true })
    checkIpSegmentLimitMock.mockResolvedValue({ allowed: true })
  })

  it('ranks higher collective interest first without mutating input', () => {
    const input = [project('Later', 2, 20), project('First', 9, 90)]
    const result = rankAwesomeProjects(input)

    expect(result.map((item) => item.title)).toEqual(['First', 'Later'])
    expect(input.map((item) => item.title)).toEqual(['Later', 'First'])
  })

  it('lists public awesome candidates with aggregate and personal scores', async () => {
    prismaMock.candidate.findMany.mockResolvedValue([
      {
        id: 'candidate-1',
        title: 'Prompt Lab',
        slug: 'prompt-lab',
        summary: 'Compare prompts',
        rawContent: JSON.stringify({
          schema: 'awesome-project.v1',
          upstreamName: 'promptfoo',
          direction: 'prompt-quality',
          license: 'MIT',
          effort: '3 DAYS',
          posture: 'INTEGRATE',
          whyItMatters: 'Evidence matters.',
          buildProposal: 'Build a matrix.',
          firstMilestone: 'Run ten cases.',
          researchNote: 'Local evaluator.',
        }),
        websiteUrl: 'https://example.test',
        sourceUrl: 'https://github.com/example/test',
        tags: '["awesome","direction:prompt-quality"]',
        status: 'watching',
        sortOrder: 10,
      },
    ])
    prismaMock.candidateInterest.groupBy.mockResolvedValue([
      {
        candidateId: 'candidate-1',
        _sum: { score: 13 },
        _avg: { score: 13 / 3 },
        _count: { _all: 3 },
      },
    ])
    prismaMock.candidateInterest.findMany.mockResolvedValue([
      { candidateId: 'candidate-1', score: 5 },
    ])

    const result = await listAwesomeProjects({
      actorType: 'anonymous',
      actorKey: 'anonymous:anon-1',
      anonymousUserId: 'anon-1',
    })

    expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tags: { contains: '"awesome"' },
        NOT: { tags: { contains: '"visibility:private"' } },
      },
    }))
    expect(result[0]).toMatchObject({
      slug: 'prompt-lab',
      tags: ['direction:prompt-quality'],
      interest: {
        totalScore: 13,
        averageScore: 4.3,
        ratingCount: 3,
        myScore: 5,
      },
    })
  })

  it('atomically upserts one anonymous score and returns the new aggregate', async () => {
    prismaMock.candidate.findFirst.mockResolvedValue({ id: 'candidate-1' })
    prismaMock.candidateInterest.aggregate.mockResolvedValue({
      _sum: { score: 9 },
      _avg: { score: 4.5 },
      _count: { _all: 2 },
    })

    const result = await setAwesomeInterest('prompt-lab', 5, {
      actorType: 'anonymous',
      actorKey: 'anonymous:anon-1',
      anonymousUserId: 'anon-1',
      ipHash: 'ip-hash',
    })

    expect(prismaMock.candidateInterest.upsert).toHaveBeenCalledWith({
      where: {
        candidateId_anonymousUserId: {
          candidateId: 'candidate-1',
          anonymousUserId: 'anon-1',
        },
      },
      update: { score: 5 },
      create: {
        candidateId: 'candidate-1',
        anonymousUserId: 'anon-1',
        score: 5,
      },
    })
    expect(result).toEqual({
      totalScore: 9,
      averageScore: 4.5,
      ratingCount: 2,
      myScore: 5,
    })
  })

  it('rejects invalid scores and actors before any write', async () => {
    await expect(setAwesomeInterest('prompt-lab', 6, {
      actorType: 'anonymous',
      actorKey: 'ip:hash',
    })).rejects.toThrow('ERR_INTEREST_SCORE_INVALID')

    await expect(setAwesomeInterest('prompt-lab', 4, {
      actorType: 'anonymous',
      actorKey: 'ip:hash',
    })).rejects.toThrow('ERR_INTEREST_IDENTITY_REQUIRED')

    expect(prismaMock.candidate.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.candidateInterest.upsert).not.toHaveBeenCalled()
  })
})
