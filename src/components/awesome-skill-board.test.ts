import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AwesomeSkillEntry } from '@/modules/candidate/awesome-skills'
import {
  AwesomeSkillBoard,
  filterAwesomeSkillCards,
  rankAwesomeSkillCards,
  type AwesomeSkillFilters,
} from './awesome-skill-board'

function buildSkill(overrides: Partial<AwesomeSkillEntry> = {}): AwesomeSkillEntry {
  return {
    id: 'skill-1',
    title: 'Prompt Optimizer',
    slug: 'prompt-optimizer',
    summary: 'Turn rough ideas into copy-ready prompts.',
    websiteUrl: 'https://example.test/skill',
    sourceUrl: 'https://github.com/example/repo',
    status: 'watching',
    sortOrder: 10,
    tags: [],
    dossier: {
      schema: 'awesome-skill.v1',
      upstreamName: 'example/repo · prompt-optimizer',
      category: 'agents',
      kinds: ['instructions'],
      compatibility: ['codex', 'generic'],
      permissions: ['read-only'],
      maturity: 'audited',
      effort: '5-min',
      license: 'MIT',
      licenseStatus: 'clear',
      artifact: 'COPY-READY PROMPT',
      whyItMatters: 'It connects a reusable capability to the Prompt research workflow.',
      firstLook: 'Compare three prompts before adopting the upstream instructions.',
      auditNote: 'Catalog only. The Skill is never executed from this surface.',
      skillUrl: 'https://github.com/example/repo/blob/main/SKILL.md',
      promptSlug: 'published-prompt',
    },
    interest: { totalScore: 8, averageScore: 4, ratingCount: 2, myScore: 4 },
    ...overrides,
  }
}

const EMPTY_FILTERS: AwesomeSkillFilters = {
  category: 'all',
  maturity: 'all',
  compatibility: 'all',
  kind: 'all',
  permission: 'all',
  effort: 'all',
  query: '',
}

describe('AwesomeSkillBoard', () => {
  it('renders a collection surface with source and Prompt links but no execution action', () => {
    const html = renderToStaticMarkup(createElement(AwesomeSkillBoard, {
      initialSkills: [buildSkill()],
      initialExpandedSlug: 'prompt-optimizer',
    }))

    expect(html).toContain('SKILL INDEX')
    expect(html).toContain('COLLECT.')
    expect(html).toContain('READ SKILL')
    expect(html).toContain('/workbench?prompt=published-prompt')
    expect(html).toContain('aria-controls="awesome-skill-details-prompt-optimizer"')
    expect(html).not.toMatch(/>\s*RUN\s*</)
  })

  it('filters array metadata and ranks the stronger signal first', () => {
    const design = buildSkill({
      id: 'design',
      slug: 'design',
      title: 'Design Skill',
      dossier: {
        ...buildSkill().dossier,
        category: 'design',
        compatibility: ['claude'],
        permissions: ['filesystem'],
      },
      interest: { totalScore: 12, averageScore: 4, ratingCount: 3, myScore: null },
    })
    const prompt = buildSkill({ id: 'prompt', slug: 'prompt' })

    expect(rankAwesomeSkillCards([prompt, design])[0]?.slug).toBe('design')
    expect(filterAwesomeSkillCards([prompt, design], {
      ...EMPTY_FILTERS,
      compatibility: 'codex',
      permission: 'read-only',
      query: 'copy-ready',
    })).toEqual([prompt])
    expect(filterAwesomeSkillCards([prompt, design], {
      ...EMPTY_FILTERS,
      category: 'hardware',
    })).toEqual([])
  })
})
