import { describe, expect, it } from 'vitest'
import {
  AWESOME_SKILL_CATEGORIES,
  AWESOME_SKILL_COMPATIBILITY,
  AWESOME_SKILL_EFFORTS,
  AWESOME_SKILL_FEEDS,
  AWESOME_SKILL_KINDS,
  AWESOME_SKILL_MATURITY,
  AWESOME_SKILL_PERMISSIONS,
  AWESOME_SKILLS,
  AWESOME_SKILL_SCHEMA,
  awesomeSkillCandidateTags,
  awesomeSkillDossierJson,
  backfillAwesomeSkillDossierJson,
  backfillAwesomeSkillTags,
} from './awesome-skills'

describe('AWESOME skill research seed', () => {
  it('keeps a unique, source-backed and risk-described skill set', () => {
    expect(AWESOME_SKILLS).toHaveLength(46)
    expect(new Set(AWESOME_SKILLS.map((skill) => skill.slug)).size).toBe(46)
    expect(new Set(AWESOME_SKILLS.map((skill) => skill.dossier.skillUrl)).size).toBe(46)
    expect(new Set(AWESOME_SKILLS.map((skill) => skill.sortOrder)).size).toBe(46)

    for (const category of AWESOME_SKILL_CATEGORIES) {
      expect(AWESOME_SKILLS.filter((skill) => skill.dossier.category === category.id).length)
        .toBeGreaterThanOrEqual(3)
    }

    for (const skill of AWESOME_SKILLS) {
      expect(skill.sourceUrl).toMatch(/^https:\/\/github\.com\//)
      expect(skill.websiteUrl).toMatch(/^https:\/\//)
      expect(skill.dossier.skillUrl).toMatch(/^https:\/\/github\.com\//)
      expect(skill.dossier.schema).toBe(AWESOME_SKILL_SCHEMA)
      expect(skill.dossier.whyItMatters.length).toBeGreaterThan(20)
      expect(skill.dossier.firstLook.length).toBeGreaterThan(20)
      expect(skill.dossier.auditNote.length).toBeGreaterThan(20)
      expect(skill.dossier.kinds.length).toBeGreaterThan(0)
      expect(skill.dossier.compatibility.length).toBeGreaterThan(0)
      expect(skill.dossier.permissions.length).toBeGreaterThan(0)
      expect(AWESOME_SKILL_CATEGORIES.map((item) => item.id)).toContain(skill.dossier.category)
      expect(AWESOME_SKILL_MATURITY.map((item) => item.id)).toContain(skill.dossier.maturity)
      expect(AWESOME_SKILL_EFFORTS.map((item) => item.id)).toContain(skill.dossier.effort)
      expect(skill.dossier.kinds.every((kind) => AWESOME_SKILL_KINDS.some((item) => item.id === kind))).toBe(true)
      expect(skill.dossier.compatibility.every((target) => AWESOME_SKILL_COMPATIBILITY.some((item) => item.id === target))).toBe(true)
      expect(skill.dossier.permissions.every((permission) => AWESOME_SKILL_PERMISSIONS.some((item) => item.id === permission))).toBe(true)
      expect(['clear', 'review', 'restricted']).toContain(skill.dossier.licenseStatus)
      expect(awesomeSkillCandidateTags(skill)).toContain('awesome')
      expect(awesomeSkillCandidateTags(skill)).toContain('catalog:skill')
      expect(JSON.parse(awesomeSkillDossierJson(skill))).toEqual(skill.dossier)
    }
  })

  it('keeps discovery feeds on source or specification domains', () => {
    expect(AWESOME_SKILL_FEEDS.length).toBeGreaterThanOrEqual(6)
    expect(AWESOME_SKILL_FEEDS.every((feed) => feed.url.startsWith('https://'))).toBe(true)
  })

  it('backfills catalog metadata without replacing user fields', () => {
    const skill = AWESOME_SKILLS[0]!
    const legacy = JSON.stringify({
      schema: AWESOME_SKILL_SCHEMA,
      upstreamName: 'user-edited upstream',
      customNote: 'preserve me',
    })
    const next = JSON.parse(backfillAwesomeSkillDossierJson(legacy, skill)!)

    expect(next).toMatchObject({
      upstreamName: 'user-edited upstream',
      customNote: 'preserve me',
      category: skill.dossier.category,
      maturity: skill.dossier.maturity,
      skillUrl: skill.dossier.skillUrl,
    })
    expect(backfillAwesomeSkillDossierJson('{broken', skill)).toBeNull()
    expect(backfillAwesomeSkillDossierJson(JSON.stringify({ schema: 'other.v1' }), skill)).toBeNull()

    const tags = JSON.parse(backfillAwesomeSkillTags('["catalog:skill","user:kept"]', skill)!)
    expect(tags).toContain('user:kept')
    expect(tags).toContain('awesome')
    expect(tags).toContain(`maturity:${skill.dossier.maturity}`)
    expect(backfillAwesomeSkillTags('{broken', skill)).toBeNull()
  })
})
