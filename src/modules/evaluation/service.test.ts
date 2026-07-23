import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EvaluationProtocol,
  EvaluationReproducibility,
  EvaluationStatus,
  EvaluationVerdict,
  TargetType,
} from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    target: { findUnique: vi.fn() },
    skill: { findUnique: vi.fn() },
    app: { findUnique: vi.fn() },
    candidate: { findUnique: vi.fn() },
    evaluation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { createEvaluation } from './service'

const prismaMock = prisma as unknown as {
  target: { findUnique: ReturnType<typeof vi.fn> }
  skill: { findUnique: ReturnType<typeof vi.fn> }
  evaluation: { create: ReturnType<typeof vi.fn> }
}

const SKILL_SCORES = {
  instruction_following: 9,
  output_quality: 8,
  reproducibility: 7,
  ease_of_use: 8,
  compatibility: 6,
  cost_efficiency: 7,
  adaptability: 8,
  failure_boundaries: 7,
}

function publishedSkillInput() {
  return {
    subjectType: 'skill' as const,
    subjectId: 's1',
    title: '代码审查 Skill 正式评测',
    protocol: EvaluationProtocol.skill,
    status: EvaluationStatus.published,
    verdict: EvaluationVerdict.verified,
    reproducibility: EvaluationReproducibility.repeated,
    subjectVersion: 'v1',
    task: '在同一个代码仓库中重复执行结构化代码审查任务。',
    output: '两次运行均识别出相同的高风险变更，并给出可执行修复建议。',
    evidence: [{ type: 'url' as const, label: '测试提交', url: 'https://example.com/commit' }],
    scores: SKILL_SCORES,
    conclusion: '该 Skill 在当前任务范围内可稳定复现，适合进入团队审查流程。',
    repeatCount: 2,
  }
}

describe('evaluation/service createEvaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.skill.findUnique.mockResolvedValue({ id: 's1', title: '代码审查 Skill', slug: 'code-review' })
    prismaMock.evaluation.create.mockResolvedValue({ id: 'e1' })
  })

  it('publishes a complete evidence-backed Skill evaluation', async () => {
    await createEvaluation(publishedSkillInput(), 'u1')

    expect(prismaMock.evaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorUserId: 'u1',
          skillId: 's1',
          targetId: null,
          protocol: EvaluationProtocol.skill,
          protocolVersion: 2,
          status: EvaluationStatus.published,
          repeatCount: 2,
          publishedAt: expect.any(Date),
        }),
      }),
    )
  })

  it('allows incomplete protocol fields while the evaluation is a draft', async () => {
    await createEvaluation({
      subjectType: 'skill',
      subjectId: 's1',
      title: '待补充评测',
      task: '记录第一次测试。',
      conclusion: '尚未形成结论。',
      status: EvaluationStatus.draft,
      scores: { output_quality: 8 },
    }, 'u1')

    expect(prismaMock.evaluation.create).toHaveBeenCalled()
  })

  it('rejects a published evaluation with incomplete dimension scores', async () => {
    await expect(createEvaluation({
      ...publishedSkillInput(),
      scores: { output_quality: 8 },
    }, 'u1')).rejects.toThrow('ERR_EVALUATION_SCORES_INCOMPLETE')
  })

  it('rejects publication without output or evidence', async () => {
    await expect(createEvaluation({
      ...publishedSkillInput(),
      output: undefined,
      evidence: [],
    }, 'u1')).rejects.toThrow('ERR_EVALUATION_EVIDENCE_REQUIRED')
  })

  it('rejects a protocol that does not match the subject type', async () => {
    prismaMock.target.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Claude',
      slug: 'claude',
      type: TargetType.model,
    })

    await expect(createEvaluation({
      ...publishedSkillInput(),
      subjectType: 'target',
      subjectId: 't1',
      protocol: EvaluationProtocol.software,
    }, 'u1')).rejects.toThrow('ERR_EVALUATION_PROTOCOL_MISMATCH')
  })
})
