import { describe, expect, it } from 'vitest'
import {
  AWESOME_COMPUTE_LEVELS,
  AWESOME_DIRECTIONS,
  AWESOME_DISCOVERY_FEEDS,
  AWESOME_PROJECTS,
  AWESOME_PROJECT_SCHEMA,
  AWESOME_READINESS,
  awesomeCandidateTags,
  awesomeDossierJson,
  backfillAwesomeDossierJson,
  backfillAwesomeTags,
} from './awesome-projects'

describe('AWESOME project research seed', () => {
  it('keeps a unique, source-backed and executable candidate set', () => {
    expect(AWESOME_PROJECTS).toHaveLength(49)
    expect(new Set(AWESOME_PROJECTS.map((project) => project.slug)).size).toBe(49)

    for (const project of AWESOME_PROJECTS) {
      expect(project.sourceUrl).toMatch(/^https:\/\/github\.com\//)
      expect(project.websiteUrl).toMatch(/^https:\/\//)
      expect(project.dossier.schema).toBe(AWESOME_PROJECT_SCHEMA)
      expect(project.dossier.whyItMatters.length).toBeGreaterThan(20)
      expect(project.dossier.buildProposal.length).toBeGreaterThan(20)
      expect(project.dossier.firstMilestone.length).toBeGreaterThan(20)
      expect(project.dossier.artifact.length).toBeGreaterThan(3)
      expect(AWESOME_DIRECTIONS.map((item) => item.id)).toContain(project.dossier.direction)
      expect(AWESOME_READINESS.map((item) => item.id)).toContain(project.dossier.readiness)
      expect(AWESOME_COMPUTE_LEVELS.map((item) => item.id)).toContain(project.dossier.compute)
      expect(['clear', 'review', 'restricted']).toContain(project.dossier.licenseStatus)
      expect(awesomeCandidateTags(project)).toContain('awesome')
      expect(awesomeCandidateTags(project)).toContain('catalog:project')
      expect(awesomeCandidateTags(project)).toContain(`readiness:${project.dossier.readiness}`)
      expect(awesomeCandidateTags(project)).toContain(`compute:${project.dossier.compute}`)
      expect(JSON.parse(awesomeDossierJson(project))).toEqual(project.dossier)
    }
  })

  it('keeps discovery feeds external and source-backed', () => {
    expect(AWESOME_DISCOVERY_FEEDS).toHaveLength(4)
    expect(AWESOME_DISCOVERY_FEEDS.every((feed) => feed.url.startsWith('https://github.com/'))).toBe(true)
  })

  it('backfills only missing catalog metadata and preserves existing data', () => {
    const project = AWESOME_PROJECTS[0]!
    const legacy = JSON.stringify({
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'user-edited upstream',
      direction: 'prompt-quality',
      customNote: 'preserve me',
    })
    const next = JSON.parse(backfillAwesomeDossierJson(legacy, project)!)

    expect(next).toMatchObject({
      upstreamName: 'user-edited upstream',
      customNote: 'preserve me',
      readiness: project.dossier.readiness,
      compute: project.dossier.compute,
      artifact: project.dossier.artifact,
      licenseStatus: project.dossier.licenseStatus,
    })
    expect(backfillAwesomeDossierJson('{broken', project)).toBeNull()
    expect(backfillAwesomeDossierJson(JSON.stringify({ schema: 'other.v1' }), project)).toBeNull()

    const tags = JSON.parse(backfillAwesomeTags('["awesome","user:kept"]', project)!)
    expect(tags).toContain('user:kept')
    expect(tags).toContain('catalog:project')
    expect(tags).toContain(`readiness:${project.dossier.readiness}`)
    expect(backfillAwesomeTags('{broken', project)).toBeNull()
  })
})
