import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AwesomeProject } from '@/modules/candidate/awesome'
import {
  AwesomeProjectBoard,
  filterAwesomeProjectCards,
  rankAwesomeProjectCards,
} from './awesome-project-board'

function buildProject(overrides: Partial<AwesomeProject> = {}): AwesomeProject {
  return {
    id: 'project-1',
    title: 'Prompt Regression Lab',
    slug: 'prompt-regression-lab',
    summary: 'Compare prompts with real evidence.',
    websiteUrl: 'https://example.test',
    sourceUrl: 'https://github.com/example/test',
    status: 'watching',
    sortOrder: 10,
    tags: [],
    dossier: {
      schema: 'awesome-project.v1',
      upstreamName: 'promptfoo',
      direction: 'prompt-quality',
      license: 'MIT',
      licenseStatus: 'clear',
      effort: '3 DAYS',
      readiness: 'ready',
      compute: 'light',
      artifact: 'EVALUATION MATRIX',
      posture: 'INTEGRATE',
      whyItMatters: 'It replaces guesswork with repeatable evidence.',
      buildProposal: 'Connect prompt versions to a stable evaluation matrix.',
      firstMilestone: 'Run ten cases across two models and save the report.',
      researchNote: 'The upstream runner stays local.',
    },
    interest: {
      totalScore: 8,
      averageScore: 4,
      ratingCount: 2,
      myScore: 4,
    },
    ...overrides,
  }
}

describe('AwesomeProjectBoard', () => {
  it('renders an actionable project queue and accessible 1-5 scoring', () => {
    const html = renderToStaticMarkup(createElement(AwesomeProjectBoard, {
      initialProjects: [buildProject()],
    }))

    expect(html).toContain('AWESOME')
    expect(html).toContain('FIND.')
    expect(html).toContain('RANK.')
    expect(html).toContain('BUILD.')
    expect(html).toContain('PROJECT RADAR')
    expect(html).toContain('OPEN-SOURCE PROJECT RADAR')
    expect(html).toContain('EVALUATION MATRIX')
    expect(html).not.toContain('这里不是收藏夹')
    expect(html).not.toContain('ENTRY CRITERIA')
    expect(html).toContain('aria-controls="awesome-details-prompt-regression-lab"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('filters by direction and ranks the stronger signal first', () => {
    const visual = buildProject({
      id: 'visual',
      slug: 'visual',
      title: 'Visual Production Lab',
      summary: 'Test image pipelines with real evidence.',
      dossier: { ...buildProject().dossier, direction: 'visual-production' },
      interest: { totalScore: 12, averageScore: 4, ratingCount: 3, myScore: null },
    })
    const prompt = buildProject({ id: 'prompt', slug: 'prompt' })

    expect(rankAwesomeProjectCards([prompt, visual])[0]?.slug).toBe('visual')
    expect(filterAwesomeProjectCards([prompt, visual], 'prompt-quality')).toEqual([prompt])
    expect(filterAwesomeProjectCards([prompt, visual], 'all', 'ready', 'light', 'regression')).toEqual([prompt])
    expect(filterAwesomeProjectCards([prompt, visual], 'all', 'hold')).toEqual([])
  })
})
