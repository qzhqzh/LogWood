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
      effort: '3 DAYS',
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
    expect(html).toContain('PROJECT QUEUE')
    expect(html).toContain('WHAT WE BUILD')
    expect(html).toContain('FIRST MILESTONE')
    expect(html).toContain('SOURCE REPO')
    expect(html).toContain('aria-label="给 Prompt Regression Lab 评分 5/5"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('filters by direction and ranks the stronger signal first', () => {
    const visual = buildProject({
      id: 'visual',
      slug: 'visual',
      dossier: { ...buildProject().dossier, direction: 'visual-production' },
      interest: { totalScore: 12, averageScore: 4, ratingCount: 3, myScore: null },
    })
    const prompt = buildProject({ id: 'prompt', slug: 'prompt' })

    expect(rankAwesomeProjectCards([prompt, visual])[0]?.slug).toBe('visual')
    expect(filterAwesomeProjectCards([prompt, visual], 'prompt-quality')).toEqual([prompt])
  })
})
