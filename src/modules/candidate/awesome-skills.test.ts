import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  candidate: { findMany: vi.fn() },
  candidateInterest: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  listAwesomeSkills,
  rankAwesomeSkills,
  type AwesomeSkillEntry,
} from './awesome-skills'

function skill(title: string, totalScore: number, sortOrder: number): AwesomeSkillEntry {
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
      schema: 'awesome-skill.v1',
      upstreamName: title,
      category: 'engineering',
      kinds: ['instructions'],
      compatibility: ['codex'],
      permissions: ['read-only'],
      maturity: 'collected',
      effort: '30-min',
      license: 'MIT',
      licenseStatus: 'clear',
      artifact: 'TEST NOTE',
      whyItMatters: 'why',
      firstLook: 'first',
      auditNote: 'note',
      skillUrl: 'https://github.com/example/repo/blob/main/SKILL.md',
    },
    interest: {
      totalScore,
      averageScore: totalScore ? 5 : null,
      ratingCount: totalScore ? 1 : 0,
      myScore: null,
    },
  }
}

describe('candidate/awesome-skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.candidate.findMany.mockResolvedValue([])
    prismaMock.candidateInterest.findMany.mockResolvedValue([])
    prismaMock.candidateInterest.groupBy.mockResolvedValue([])
  })

  it('ranks stronger interest first without mutating input', () => {
    const input = [skill('Later', 2, 10), skill('First', 8, 90)]
    expect(rankAwesomeSkills(input).map((item) => item.title)).toEqual(['First', 'Later'])
    expect(input.map((item) => item.title)).toEqual(['Later', 'First'])
  })

  it('lists only public Skill catalog candidates with personal scores', async () => {
    prismaMock.candidate.findMany.mockResolvedValue([{
      id: 'skill-1',
      title: 'Prompt Optimizer',
      slug: 'prompt-optimizer',
      summary: 'Improve prompts.',
      rawContent: JSON.stringify({
        schema: 'awesome-skill.v1',
        upstreamName: 'github/awesome-copilot · prompt-optimizer',
        category: 'agents',
        kinds: ['instructions'],
        compatibility: ['generic'],
        permissions: ['read-only'],
        maturity: 'collected',
        effort: '5-min',
        license: 'MIT',
        licenseStatus: 'clear',
        artifact: 'COPY-READY PROMPT',
        whyItMatters: 'Useful prompt bridge.',
        firstLook: 'Compare three examples.',
        auditNote: 'Do not run from the catalog.',
        skillUrl: 'https://github.com/github/awesome-copilot/blob/main/skills/prompt-optimizer/SKILL.md',
      }),
      websiteUrl: 'https://github.com/github/awesome-copilot/tree/main/skills/prompt-optimizer',
      sourceUrl: 'https://github.com/github/awesome-copilot',
      tags: '["awesome","catalog:skill","maturity:collected"]',
      status: 'watching',
      sortOrder: 10,
    }])
    prismaMock.candidateInterest.groupBy.mockResolvedValue([{
      candidateId: 'skill-1',
      _sum: { score: 5 },
      _avg: { score: 5 },
      _count: { _all: 1 },
    }])
    prismaMock.candidateInterest.findMany.mockResolvedValue([{
      candidateId: 'skill-1',
      score: 5,
    }])

    const result = await listAwesomeSkills({
      actorType: 'anonymous',
      actorKey: 'anonymous:anon-1',
      anonymousUserId: 'anon-1',
    })

    expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { tags: { contains: '"awesome"' } },
          { tags: { contains: '"catalog:skill"' } },
        ],
        NOT: { tags: { contains: '"visibility:private"' } },
      },
    }))
    expect(result[0]).toMatchObject({
      slug: 'prompt-optimizer',
      tags: ['maturity:collected'],
      dossier: { category: 'agents', maturity: 'collected' },
      interest: { totalScore: 5, averageScore: 5, ratingCount: 1, myScore: 5 },
    })
  })
})
