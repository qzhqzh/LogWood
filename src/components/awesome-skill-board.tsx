'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AWESOME_SKILL_CATEGORIES,
  AWESOME_SKILL_COMPATIBILITY,
  AWESOME_SKILL_EFFORTS,
  AWESOME_SKILL_KINDS,
  AWESOME_SKILL_MATURITY,
  AWESOME_SKILL_PERMISSIONS,
  type AwesomeSkillCategory,
  type AwesomeSkillCompatibility,
  type AwesomeSkillEffort,
  type AwesomeSkillKind,
  type AwesomeSkillMaturity,
  type AwesomeSkillPermission,
} from '@/content/awesome-skills'
import type { AwesomeInterestSummary } from '@/modules/candidate/awesome'
import type { AwesomeSkillEntry } from '@/modules/candidate/awesome-skills'
import styles from './awesome-project-board.module.css'

type FilterValue<T extends string> = T | 'all'

export interface AwesomeSkillFilters {
  category: FilterValue<AwesomeSkillCategory>
  maturity: FilterValue<AwesomeSkillMaturity>
  compatibility: FilterValue<AwesomeSkillCompatibility>
  kind: FilterValue<AwesomeSkillKind>
  permission: FilterValue<AwesomeSkillPermission>
  effort: FilterValue<AwesomeSkillEffort>
  query: string
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

const STATUS_LABELS: Record<string, string> = {
  watching: 'CATALOGUED',
  evaluating: 'AUDITING',
  promoted: 'ADOPTED',
  dropped: 'ARCHIVED',
}

const INTEREST_ERRORS: Record<string, string> = {
  ERR_INTEREST_SCORE_INVALID: '评分必须在 1–5 之间。',
  ERR_INTEREST_IDENTITY_REQUIRED: '无法建立匿名身份，请刷新后重试。',
  ERR_AWESOME_PROJECT_NOT_FOUND: '这个 Skill 已不存在或不再公开。',
  ERR_RATE_LIMIT_EXCEEDED: '今天的操作有点多，请稍后再试。',
  ERR_AWESOME_UNAVAILABLE: '评分服务暂时不可用，请稍后重试。',
}

export function rankAwesomeSkillCards(skills: AwesomeSkillEntry[]): AwesomeSkillEntry[] {
  return [...skills].sort((left, right) => (
    right.interest.totalScore - left.interest.totalScore
    || right.interest.ratingCount - left.interest.ratingCount
    || (right.interest.averageScore ?? 0) - (left.interest.averageScore ?? 0)
    || left.sortOrder - right.sortOrder
    || left.title.localeCompare(right.title)
  ))
}

export function filterAwesomeSkillCards(
  skills: AwesomeSkillEntry[],
  filters: AwesomeSkillFilters,
): AwesomeSkillEntry[] {
  const query = filters.query.trim().toLocaleLowerCase()

  return skills.filter((skill) => {
    if (filters.category !== 'all' && skill.dossier.category !== filters.category) return false
    if (filters.maturity !== 'all' && skill.dossier.maturity !== filters.maturity) return false
    if (
      filters.compatibility !== 'all'
      && !skill.dossier.compatibility.includes(filters.compatibility)
    ) return false
    if (filters.kind !== 'all' && !skill.dossier.kinds.includes(filters.kind)) return false
    if (
      filters.permission !== 'all'
      && !skill.dossier.permissions.includes(filters.permission)
    ) return false
    if (filters.effort !== 'all' && skill.dossier.effort !== filters.effort) return false
    if (!query) return true

    return [
      skill.title,
      skill.summary,
      skill.dossier.upstreamName,
      skill.dossier.artifact,
      skill.dossier.category,
      ...skill.dossier.kinds,
      ...skill.dossier.compatibility,
    ].join(' ').toLocaleLowerCase().includes(query)
  })
}

function getFingerprint(): string {
  if (typeof window === 'undefined') return ''
  const key = 'logwood_device_fingerprint'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const generated = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, generated)
  return generated
}

function updateSkillInterest(
  skills: AwesomeSkillEntry[],
  slug: string,
  interest: AwesomeInterestSummary,
) {
  return rankAwesomeSkillCards(skills.map((skill) => (
    skill.slug === slug ? { ...skill, interest } : skill
  )))
}

function countMatching<T extends string>(
  skills: AwesomeSkillEntry[],
  read: (skill: AwesomeSkillEntry) => T | readonly T[],
  value: T,
) {
  return skills.filter((skill) => {
    const candidate = read(skill)
    return Array.isArray(candidate) ? candidate.includes(value) : candidate === value
  }).length
}

export function AwesomeSkillBoard({
  initialSkills,
  initialExpandedSlug = null,
  syncScores = true,
}: {
  initialSkills: AwesomeSkillEntry[]
  initialExpandedSlug?: string | null
  syncScores?: boolean
}) {
  const [skills, setSkills] = useState(() => rankAwesomeSkillCards(initialSkills))
  const [filters, setFilters] = useState<AwesomeSkillFilters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(initialExpandedSlug)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [noticeBySlug, setNoticeBySlug] = useState<Record<string, string>>({})
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!syncScores) return

    const fingerprint = getFingerprint()
    const controller = new AbortController()

    async function loadMyScores() {
      try {
        const response = await fetch(
          `/api/awesome/skills?fingerprint=${encodeURIComponent(fingerprint)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        if (!response.ok) throw new Error('ERR_AWESOME_UNAVAILABLE')
        const payload = await response.json() as { skills?: AwesomeSkillEntry[] }
        if (payload.skills) setSkills(rankAwesomeSkillCards(payload.skills))
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setSyncNotice('历史评分暂未同步，总榜仍可浏览。')
      }
    }

    void loadMyScores()
    return () => controller.abort()
  }, [syncScores])

  async function setInterest(slug: string, score: number) {
    setPendingSlug(slug)
    setNoticeBySlug((current) => ({ ...current, [slug]: '正在保存评分…' }))

    try {
      const response = await fetch(`/api/awesome/${encodeURIComponent(slug)}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, deviceFingerprint: getFingerprint() }),
      })
      const payload = await response.json() as {
        interest?: AwesomeInterestSummary
        error?: string
      }
      if (!response.ok || !payload.interest) {
        throw new Error(payload.error || 'ERR_AWESOME_UNAVAILABLE')
      }

      setSkills((current) => updateSkillInterest(current, slug, payload.interest!))
      setNoticeBySlug((current) => ({ ...current, [slug]: `已记录 ${score}/5，榜单已重排。` }))
    } catch (error) {
      const code = error instanceof Error ? error.message : 'ERR_AWESOME_UNAVAILABLE'
      setNoticeBySlug((current) => ({
        ...current,
        [slug]: INTEREST_ERRORS[code] || INTEREST_ERRORS.ERR_AWESOME_UNAVAILABLE,
      }))
    } finally {
      setPendingSlug(null)
    }
  }

  function setFilter<K extends keyof AwesomeSkillFilters>(
    key: K,
    value: AwesomeSkillFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const visibleSkills = useMemo(
    () => filterAwesomeSkillCards(skills, filters),
    [filters, skills],
  )
  const inspectedSkills = skills.filter((skill) => skill.dossier.maturity !== 'collected').length
  const provenSkills = skills.filter((skill) => skill.dossier.maturity === 'proven').length
  const promptLinkedSkills = skills.filter((skill) => Boolean(skill.dossier.promptSlug)).length
  const totalSignal = skills.reduce((sum, skill) => sum + skill.interest.totalScore, 0)
  const activeFilterCount = Object.entries(filters).reduce((count, [key, value]) => (
    count + Number(key === 'query' ? Boolean(String(value).trim()) : value !== 'all')
  ), 0)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1>SKILLS</h1>
          <div className={styles.statement}>
            <p>
              COLLECT.<br />
              INSPECT.<br />
              <strong>PROVE.</strong>
            </p>
            <span>AGENT SKILL INDEX</span>
          </div>
        </div>
        <div className={styles.headerRail} aria-label="Skill Index status">
          <span>{skills.length} SKILLS</span>
          <span>{inspectedSkills} INSPECTED</span>
          <span>{provenSkills} PROVEN</span>
          <span>{promptLinkedSkills} PROMPT LINKS</span>
          <strong>{totalSignal} INTEREST SIGNAL</strong>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.filters} aria-label="Skill filters">
          <button
            type="button"
            className={styles.filterToggle}
            aria-expanded={filtersOpen}
            aria-controls="awesome-skill-filter-controls"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <span>FILTERS</span>
            <small>{activeFilterCount > 0 ? `${activeFilterCount} ACTIVE` : 'OPEN +'}</small>
          </button>

          <div
            id="awesome-skill-filter-controls"
            className={styles.filterControls}
            data-open={filtersOpen}
          >
            <div className={styles.searchBlock}>
              <label htmlFor="awesome-skill-search">SEARCH</label>
              <input
                id="awesome-skill-search"
                type="search"
                value={filters.query}
                onChange={(event) => setFilter('query', event.target.value)}
                placeholder="SKILLS, OUTPUTS, SOURCES"
              />
            </div>

            <FilterGroup title="MATURITY">
              <FilterButton
                active={filters.maturity === 'all'}
                label="ALL STAGES"
                count={skills.length}
                onClick={() => setFilter('maturity', 'all')}
              />
              {AWESOME_SKILL_MATURITY.map((item) => (
                <FilterButton
                  key={item.id}
                  active={filters.maturity === item.id}
                  label={item.label}
                  count={countMatching(skills, (skill) => skill.dossier.maturity, item.id)}
                  onClick={() => setFilter('maturity', item.id)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="COMPATIBILITY">
              <FilterButton
                active={filters.compatibility === 'all'}
                label="ANY AGENT"
                count={skills.length}
                onClick={() => setFilter('compatibility', 'all')}
              />
              {AWESOME_SKILL_COMPATIBILITY.map((item) => (
                <FilterButton
                  key={item.id}
                  active={filters.compatibility === item.id}
                  label={item.label}
                  count={countMatching(skills, (skill) => skill.dossier.compatibility, item.id)}
                  onClick={() => setFilter('compatibility', item.id)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="KIND">
              <FilterButton
                active={filters.kind === 'all'}
                label="ANY KIND"
                count={skills.length}
                onClick={() => setFilter('kind', 'all')}
              />
              {AWESOME_SKILL_KINDS.map((item) => (
                <FilterButton
                  key={item.id}
                  active={filters.kind === item.id}
                  label={item.label}
                  count={countMatching(skills, (skill) => skill.dossier.kinds, item.id)}
                  onClick={() => setFilter('kind', item.id)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="ACCESS">
              <FilterButton
                active={filters.permission === 'all'}
                label="ANY ACCESS"
                count={skills.length}
                onClick={() => setFilter('permission', 'all')}
              />
              {AWESOME_SKILL_PERMISSIONS.map((item) => (
                <FilterButton
                  key={item.id}
                  active={filters.permission === item.id}
                  label={item.label}
                  count={countMatching(skills, (skill) => skill.dossier.permissions, item.id)}
                  onClick={() => setFilter('permission', item.id)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="EFFORT">
              <FilterButton
                active={filters.effort === 'all'}
                label="ANY TIME"
                count={skills.length}
                onClick={() => setFilter('effort', 'all')}
              />
              {AWESOME_SKILL_EFFORTS.map((item) => (
                <FilterButton
                  key={item.id}
                  active={filters.effort === item.id}
                  label={item.label}
                  count={countMatching(skills, (skill) => skill.dossier.effort, item.id)}
                  onClick={() => setFilter('effort', item.id)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="FIELD">
              <FilterButton
                active={filters.category === 'all'}
                label="ALL FIELDS"
                count={skills.length}
                onClick={() => setFilter('category', 'all')}
              />
              {AWESOME_SKILL_CATEGORIES.map((item) => (
                <FilterButton
                  key={item.id}
                  active={filters.category === item.id}
                  label={item.label}
                  count={countMatching(skills, (skill) => skill.dossier.category, item.id)}
                  onClick={() => setFilter('category', item.id)}
                />
              ))}
            </FilterGroup>
          </div>
        </aside>

        <section className={styles.queue} aria-labelledby="awesome-skill-index-title">
          <div className={styles.queueHeading}>
            <div>
              <h2 id="awesome-skill-index-title">SKILL INDEX</h2>
              <span>{String(visibleSkills.length).padStart(2, '0')} / {String(skills.length).padStart(2, '0')}</span>
            </div>
            <span aria-live="polite">{syncNotice || 'READ · SCORE · TRY LATER'}</span>
          </div>

          {visibleSkills.length === 0 ? (
            <div className={styles.empty}>
              <strong>NO MATCHES</strong>
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>RESET FILTERS</button>
            </div>
          ) : (
            <ol className={styles.ledger}>
              {visibleSkills.map((skill) => {
                const globalRank = skills.findIndex((item) => item.slug === skill.slug) + 1
                const isExpanded = expandedSlug === skill.slug
                const isPending = pendingSlug === skill.slug
                const notice = noticeBySlug[skill.slug]
                const detailsId = `awesome-skill-details-${skill.slug}`

                return (
                  <li key={skill.id} className={styles.project}>
                    <div className={styles.rank} aria-label={`当前总榜第 ${globalRank} 名`}>
                      <span>RANK</span>
                      <strong>{String(globalRank).padStart(2, '0')}</strong>
                    </div>

                    <article className={styles.projectBody}>
                      <button
                        type="button"
                        className={styles.projectToggle}
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        onClick={() => setExpandedSlug(isExpanded ? null : skill.slug)}
                      >
                        <div className={styles.projectLead}>
                          <div className={styles.projectMeta}>
                            <span>{skill.dossier.maturity.toUpperCase()}</span>
                            <span>{skill.dossier.category.toUpperCase()}</span>
                            <span>{skill.dossier.compatibility.join(' / ').toUpperCase()}</span>
                          </div>
                          <h3>{skill.title}</h3>
                          <p>{skill.summary}</p>
                        </div>
                        <div className={styles.projectSignal}>
                          <span>{skill.dossier.artifact}</span>
                          <strong>{skill.interest.totalScore}</strong>
                          <small>{isExpanded ? 'CLOSE −' : 'OPEN +'}</small>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div id={detailsId} className={styles.projectDetails}>
                          <div className={styles.upstreamRail}>
                            <span>{skill.dossier.upstreamName}</span>
                            <span>{skill.dossier.kinds.join(' / ').toUpperCase()}</span>
                            <span>{skill.dossier.permissions.join(' / ').toUpperCase()}</span>
                            <span>{skill.dossier.effort.toUpperCase().replace('-', ' ')}</span>
                            <span>{skill.dossier.licenseStatus.toUpperCase()} LICENSE</span>
                            <span>{STATUS_LABELS[skill.status] || skill.status.toUpperCase()}</span>
                          </div>

                          <div className={styles.projectReasoning}>
                            <section>
                              <h4>WHY IT MATTERS</h4>
                              <p>{skill.dossier.whyItMatters}</p>
                            </section>
                            <section>
                              <h4>FIRST LOOK</h4>
                              <p>{skill.dossier.firstLook}</p>
                            </section>
                            <section>
                              <h4>AUDIT NOTE</h4>
                              <p>{skill.dossier.auditNote}</p>
                            </section>
                          </div>

                          <footer className={styles.projectFooter}>
                            <div className={styles.sourceLinks}>
                              {skill.sourceUrl ? (
                                <a href={skill.sourceUrl} target="_blank" rel="noopener noreferrer">
                                  SOURCE REPO ↗
                                </a>
                              ) : null}
                              {skill.dossier.skillUrl ? (
                                <a href={skill.dossier.skillUrl} target="_blank" rel="noopener noreferrer">
                                  READ SKILL ↗
                                </a>
                              ) : null}
                              {skill.dossier.promptSlug ? (
                                <Link href={`/workbench?prompt=${encodeURIComponent(skill.dossier.promptSlug)}`}>
                                  VIEW PROMPT →
                                </Link>
                              ) : null}
                            </div>

                            <div className={styles.interestPanel}>
                              <div className={styles.interestStats}>
                                <span>INTEREST</span>
                                <strong>{skill.interest.totalScore}</strong>
                                <small>
                                  {skill.interest.ratingCount > 0
                                    ? `${skill.interest.averageScore}/5 · ${skill.interest.ratingCount} PEOPLE`
                                    : 'NO SIGNAL YET'}
                                </small>
                              </div>
                              <fieldset disabled={isPending}>
                                <legend>YOUR SCORE</legend>
                                <div>
                                  {[1, 2, 3, 4, 5].map((score) => (
                                    <button
                                      key={score}
                                      type="button"
                                      aria-label={`给 ${skill.title} 评分 ${score}/5`}
                                      aria-pressed={skill.interest.myScore === score}
                                      onClick={() => void setInterest(skill.slug, score)}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </fieldset>
                            </div>
                          </footer>
                          <p className={styles.notice} aria-live="polite">
                            {notice || (skill.interest.myScore
                              ? `YOUR SCORE ${skill.interest.myScore}/5`
                              : 'RATE 1–5 · CHANGE ANYTIME')}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.filterGroup}>
      <div className={styles.filterHeading}>
        <h2>{title}</h2>
      </div>
      <div className={styles.filterList} role="group" aria-label={`${title} filter`}>
        {children}
      </div>
    </section>
  )
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}>
      <span>{label}</span><small>{count}</small>
    </button>
  )
}
