import { describe, expect, it } from 'vitest'
import {
  AWESOME_PROJECTS,
  AWESOME_PROJECT_SCHEMA,
  awesomeCandidateTags,
  awesomeDossierJson,
} from './awesome-projects'

describe('AWESOME project research seed', () => {
  it('keeps a unique, source-backed and executable candidate set', () => {
    expect(AWESOME_PROJECTS).toHaveLength(8)
    expect(new Set(AWESOME_PROJECTS.map((project) => project.slug)).size).toBe(8)

    for (const project of AWESOME_PROJECTS) {
      expect(project.sourceUrl).toMatch(/^https:\/\/github\.com\//)
      expect(project.websiteUrl).toMatch(/^https:\/\//)
      expect(project.dossier.schema).toBe(AWESOME_PROJECT_SCHEMA)
      expect(project.dossier.whyItMatters.length).toBeGreaterThan(20)
      expect(project.dossier.buildProposal.length).toBeGreaterThan(20)
      expect(project.dossier.firstMilestone.length).toBeGreaterThan(20)
      expect(awesomeCandidateTags(project)).toContain('awesome')
      expect(JSON.parse(awesomeDossierJson(project))).toEqual(project.dossier)
    }
  })
})
