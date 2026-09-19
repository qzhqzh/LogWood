import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AgentSkillManager } from './skill-manager'

describe('Agent Skill manager', () => {
  it('renders the admin inventory and editor without exposing a run action', () => {
    const html = renderToStaticMarkup(createElement(AgentSkillManager, {
      initialSkills: [{
        id: 'skill-1',
        slug: 'awesome-skill-sepia',
        title: 'Sepia',
        summary: 'Humanize article structure',
        websiteUrl: 'https://github.com/Nanako0129/sepia',
        sourceUrl: 'https://github.com/Nanako0129/sepia',
        rawContent: '{}',
        status: 'dropped',
        updatedAt: '2026-09-19T00:00:00.000Z',
        dossier: null,
      }],
    }))

    expect(html).toContain('Skill 库管理中心')
    expect(html).toContain('Sepia')
    expect(html).toContain('已归档')
    expect(html).toContain('/awesome/skills?skill=awesome-skill-sepia')
    expect(html).toContain('/api/awesome/skills/manage?export=1')
    expect(html).toContain('Skill 文件 URL')
    expect(html).not.toMatch(/>\s*运行 Skill\s*</)
  })
})
