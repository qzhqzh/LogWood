import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  candidate: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  skill: { findFirst: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  createManagedAgentSkill,
  listManagedAgentSkills,
  managedSkillInputSchema,
  updateManagedAgentSkill,
  type ManagedSkillInput,
} from './skill-catalog-management'

const sample: ManagedSkillInput = {
  title: 'Sepia',
  summary: '结构级写作诊断与修改',
  sourceUrl: 'https://github.com/Nanako0129/sepia',
  websiteUrl: 'https://github.com/Nanako0129/sepia',
  status: 'watching',
  dossier: {
    schema: 'awesome-skill.v1',
    upstreamName: 'Nanako0129/sepia',
    category: 'creation',
    kinds: ['instructions'],
    compatibility: ['codex'],
    permissions: ['read-only'],
    maturity: 'collected',
    effort: '30-min',
    license: 'MIT',
    licenseStatus: 'clear',
    artifact: 'ARTICLE REVIEW',
    whyItMatters: 'Diagnose structural patterns without changing author intent.',
    firstLook: 'Run a review on a known article before attempting revisions.',
    auditNote: 'Not tested on Chinese articles yet; keep claims separate.',
    skillUrl: 'https://github.com/Nanako0129/sepia/blob/main/skills/sepia/SKILL.md',
  },
}

describe('Agent Skill catalog management', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    prismaMock.candidate.findMany.mockResolvedValue([])
  })

  it('validates links and metadata, retaining extra provenance fields', () => {
    expect(managedSkillInputSchema.safeParse({ ...sample, sourceUrl: 'file:///etc/passwd' }).success).toBe(false)
    expect(managedSkillInputSchema.safeParse({ ...sample, dossier: { ...sample.dossier, permissions: [] } }).success).toBe(false)
    const result = managedSkillInputSchema.parse({
      ...sample,
      dossier: { ...sample.dossier, provenance: { commit: 'pinned-upstream-commit' } },
    })
    expect(result.dossier.provenance).toEqual({ commit: 'pinned-upstream-commit' })
  })

  it('includes malformed records in the export without losing their source data', async () => {
    prismaMock.candidate.findMany.mockResolvedValue([{
      id: 'id-1', slug: 'awesome-skill-sepia', title: 'Sepia',
      summary: sample.summary, websiteUrl: sample.websiteUrl,
      sourceUrl: sample.sourceUrl, rawContent: '{broken',
      status: 'watching', updatedAt: new Date('2026-09-19T00:00:00.000Z'),
    }])
    const rows = await listManagedAgentSkills()
    expect(rows[0]).toMatchObject({
      id: 'id-1', rawContent: '{broken', dossier: null,
      updatedAt: '2026-09-19T00:00:00.000Z',
    })
  })

  it('creates a catalog entry, never a published executable Prompt', async () => {
    prismaMock.candidate.create.mockResolvedValue({ id: 'id-1', slug: 'awesome-skill-sepia' })
    await createManagedAgentSkill(sample, 'admin-1')
    expect(prismaMock.candidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'awesome-skill-sepia', authorUserId: 'admin-1', status: 'watching',
        tags: expect.stringContaining('catalog:skill'),
      }),
      select: { id: true, slug: true },
    })
    expect(prismaMock.skill.findFirst).not.toHaveBeenCalled()
  })

  it('prevents adding an existing upstream Skill under a different title', async () => {
    prismaMock.candidate.findMany.mockResolvedValue([{
      id: 'existing', rawContent: JSON.stringify(sample.dossier),
    }])
    await expect(createManagedAgentSkill({ ...sample, title: 'Sepia 2' }, 'admin-1'))
      .rejects.toThrow('ERR_SKILL_CATALOG_SOURCE_DUPLICATE')
    expect(prismaMock.candidate.create).not.toHaveBeenCalled()
  })

  it('rejects an unrelated Candidate and prevents overwriting a changed record', async () => {
    prismaMock.candidate.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'id-1', tags: '["awesome","catalog:skill","user:kept"]',
      rawContent: JSON.stringify(sample.dossier), status: 'watching',
    })
    const update = { ...sample, id: 'id-1', updatedAt: '2026-09-19T00:00:00.000Z' }
    await expect(updateManagedAgentSkill(update)).rejects.toThrow('ERR_SKILL_CATALOG_NOT_FOUND')
    prismaMock.candidate.updateMany.mockResolvedValue({ count: 0 })
    await expect(updateManagedAgentSkill(update)).rejects.toThrow('ERR_SKILL_CATALOG_CONFLICT')
    expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'id-1', updatedAt: new Date(update.updatedAt),
        rawContent: JSON.stringify(sample.dossier),
      }),
      data: expect.objectContaining({ tags: expect.stringContaining('user:kept') }),
    }))
  })

  it('links only an already published Prompt', async () => {
    prismaMock.skill.findFirst.mockResolvedValue(null)
    await expect(createManagedAgentSkill({
      ...sample,
      dossier: { ...sample.dossier, promptSlug: 'private-prompt' },
    }, 'admin-1')).rejects.toThrow('ERR_SKILL_CATALOG_PROMPT_NOT_PUBLISHED')
    expect(prismaMock.candidate.create).not.toHaveBeenCalled()
  })
})
