'use client'

import React, { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AWESOME_COMPUTE_LEVELS,
  AWESOME_DIRECTIONS,
  AWESOME_READINESS,
  type AwesomeComputeLevel,
  type AwesomeDirection,
  type AwesomeReadiness,
} from '@/content/awesome-projects'
import type {
  AwesomeInterestSummary,
  AwesomeProject,
} from '@/modules/candidate/awesome'
import styles from './awesome-project-board.module.css'

type AwesomeDirectionFilter = AwesomeDirection | 'all'
type AwesomeReadinessFilter = AwesomeReadiness | 'all'
type AwesomeComputeFilter = AwesomeComputeLevel | 'all'

const STATUS_LABELS: Record<string, string> = {
  watching: 'BACKLOG',
  evaluating: 'RESEARCHING',
  promoted: 'ACTIVE',
  dropped: 'PAUSED',
}

const INTEREST_ERRORS: Record<string, string> = {
  ERR_INTEREST_SCORE_INVALID: '评分必须在 1–5 之间。',
  ERR_INTEREST_IDENTITY_REQUIRED: '无法建立匿名身份，请刷新后重试。',
  ERR_AWESOME_PROJECT_NOT_FOUND: '这个候选已不存在或不再公开。',
  ERR_RATE_LIMIT_EXCEEDED: '今天的操作有点多，请稍后再试。',
  ERR_AWESOME_UNAVAILABLE: '评分服务暂时不可用，请稍后重试。',
}

export function rankAwesomeProjectCards(projects: AwesomeProject[]): AwesomeProject[] {
  return [...projects].sort((left, right) => (
    right.interest.totalScore - left.interest.totalScore
    || right.interest.ratingCount - left.interest.ratingCount
    || (right.interest.averageScore ?? 0) - (left.interest.averageScore ?? 0)
    || left.sortOrder - right.sortOrder
    || left.title.localeCompare(right.title)
  ))
}

export function filterAwesomeProjectCards(
  projects: AwesomeProject[],
  direction: AwesomeDirectionFilter,
  readiness: AwesomeReadinessFilter = 'all',
  compute: AwesomeComputeFilter = 'all',
  query = '',
): AwesomeProject[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return projects.filter((project) => {
    if (direction !== 'all' && project.dossier.direction !== direction) return false
    if (readiness !== 'all' && project.dossier.readiness !== readiness) return false
    if (compute !== 'all' && project.dossier.compute !== compute) return false
    if (!normalizedQuery) return true

    const searchText = [
      project.title,
      project.summary,
      project.dossier.upstreamName,
      project.dossier.artifact,
      project.dossier.direction,
      project.dossier.buildProposal,
    ].join(' ').toLocaleLowerCase()
    return searchText.includes(normalizedQuery)
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

function updateProjectInterest(
  projects: AwesomeProject[],
  slug: string,
  interest: AwesomeInterestSummary,
) {
  return rankAwesomeProjectCards(projects.map((project) => (
    project.slug === slug ? { ...project, interest } : project
  )))
}

interface AwesomeProjectBoardProps {
  initialProjects: AwesomeProject[]
}

export function AwesomeProjectBoard({ initialProjects }: AwesomeProjectBoardProps) {
  const [projects, setProjects] = useState(() => rankAwesomeProjectCards(initialProjects))
  const [direction, setDirection] = useState<AwesomeDirectionFilter>('all')
  const [readiness, setReadiness] = useState<AwesomeReadinessFilter>('all')
  const [compute, setCompute] = useState<AwesomeComputeFilter>('all')
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [noticeBySlug, setNoticeBySlug] = useState<Record<string, string>>({})
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  useEffect(() => {
    const fingerprint = getFingerprint()
    const controller = new AbortController()

    async function loadMyScores() {
      try {
        const response = await fetch(
          `/api/awesome?fingerprint=${encodeURIComponent(fingerprint)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        if (!response.ok) throw new Error('ERR_AWESOME_UNAVAILABLE')
        const payload = await response.json() as { projects?: AwesomeProject[] }
        if (payload.projects) setProjects(rankAwesomeProjectCards(payload.projects))
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setSyncNotice('历史评分暂未同步，总榜仍可浏览。')
      }
    }

    void loadMyScores()
    return () => controller.abort()
  }, [])

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

      setProjects((current) => updateProjectInterest(current, slug, payload.interest!))
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

  function resetFilters() {
    setDirection('all')
    setReadiness('all')
    setCompute('all')
    setQuery('')
  }

  const visibleProjects = useMemo(
    () => filterAwesomeProjectCards(projects, direction, readiness, compute, query),
    [compute, direction, projects, query, readiness],
  )
  const readyProjects = projects.filter((project) => project.dossier.readiness === 'ready').length
  const heavyProjects = projects.filter((project) => project.dossier.compute === 'heavy').length
  const holdProjects = projects.filter((project) => project.dossier.readiness === 'hold').length
  const totalSignal = projects.reduce((sum, project) => sum + project.interest.totalScore, 0)
  const activeFilterCount = Number(direction !== 'all')
    + Number(readiness !== 'all')
    + Number(compute !== 'all')
    + Number(Boolean(query.trim()))

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1>AWESOME</h1>
          <div className={styles.statement}>
            <p>
              FIND.<br />
              RANK.<br />
              <strong>BUILD.</strong>
            </p>
            <span>OPEN-SOURCE PROJECT RADAR</span>
          </div>
        </div>
        <div className={styles.headerRail} aria-label="项目雷达状态">
          <span>{projects.length} PROJECTS</span>
          <span>{readyProjects} READY</span>
          <span>{heavyProjects} HEAVY COMPUTE</span>
          <span>{holdProjects} ON HOLD</span>
          <strong>{totalSignal} INTEREST SIGNAL</strong>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.filters} aria-label="项目筛选">
          <button
            type="button"
            className={styles.filterToggle}
            aria-expanded={filtersOpen}
            aria-controls="awesome-filter-controls"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <span>FILTERS</span>
            <small>{activeFilterCount > 0 ? `${activeFilterCount} ACTIVE` : 'OPEN +'}</small>
          </button>

          <div
            id="awesome-filter-controls"
            className={styles.filterControls}
            data-open={filtersOpen}
          >
            <div className={styles.searchBlock}>
              <label htmlFor="awesome-search">SEARCH</label>
              <input
                id="awesome-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PROJECTS, TOOLS, OUTPUTS"
              />
            </div>

          <FilterGroup title="READINESS">
            <button
              type="button"
              aria-pressed={readiness === 'all'}
              onClick={() => setReadiness('all')}
            >
              <span>ALL STAGES</span><small>{projects.length}</small>
            </button>
            {AWESOME_READINESS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={readiness === item.id}
                onClick={() => setReadiness(item.id)}
              >
                <span>{item.label}</span>
                <small>{projects.filter((project) => project.dossier.readiness === item.id).length}</small>
              </button>
            ))}
          </FilterGroup>

          <FilterGroup title="COMPUTE">
            <button
              type="button"
              aria-pressed={compute === 'all'}
              onClick={() => setCompute('all')}
            >
              <span>ANY</span><small>{projects.length}</small>
            </button>
            {AWESOME_COMPUTE_LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={compute === item.id}
                onClick={() => setCompute(item.id)}
              >
                <span>{item.label}</span>
                <small>{projects.filter((project) => project.dossier.compute === item.id).length}</small>
              </button>
            ))}
          </FilterGroup>

          <FilterGroup title="FIELDS">
            <button
              type="button"
              aria-pressed={direction === 'all'}
              onClick={() => setDirection('all')}
            >
              <span>ALL DIRECTIONS</span><small>{projects.length}</small>
            </button>
            {AWESOME_DIRECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={direction === item.id}
                onClick={() => setDirection(item.id)}
              >
                <span>{item.label}</span>
                <small>{projects.filter((project) => project.dossier.direction === item.id).length}</small>
              </button>
            ))}
          </FilterGroup>

          </div>
        </aside>

        <section className={styles.queue} aria-labelledby="awesome-queue-title">
          <div className={styles.queueHeading}>
            <div>
              <h2 id="awesome-queue-title">PROJECT RADAR</h2>
              <span>{String(visibleProjects.length).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</span>
            </div>
            <span aria-live="polite">{syncNotice || 'SCAN · OPEN · SCORE'}</span>
          </div>

          {visibleProjects.length === 0 ? (
            <div className={styles.empty}>
              <strong>NO MATCHES</strong>
              <button type="button" onClick={resetFilters}>RESET FILTERS</button>
            </div>
          ) : (
            <ol className={styles.ledger}>
              {visibleProjects.map((project) => {
                const globalRank = projects.findIndex((item) => item.slug === project.slug) + 1
                const isExpanded = expandedSlug === project.slug
                const isPending = pendingSlug === project.slug
                const notice = noticeBySlug[project.slug]
                const detailsId = `awesome-details-${project.slug}`

                return (
                  <li key={project.id} className={styles.project}>
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
                        onClick={() => setExpandedSlug(isExpanded ? null : project.slug)}
                      >
                        <div className={styles.projectLead}>
                          <div className={styles.projectMeta}>
                            <span>{project.dossier.readiness.toUpperCase()}</span>
                            <span>{project.dossier.compute.toUpperCase()} COMPUTE</span>
                            <span>{project.dossier.direction.replaceAll('-', ' ').toUpperCase()}</span>
                          </div>
                          <h3>{project.title}</h3>
                          <p>{project.summary}</p>
                        </div>
                        <div className={styles.projectSignal}>
                          <span>{project.dossier.artifact}</span>
                          <strong>{project.interest.totalScore}</strong>
                          <small>{isExpanded ? 'CLOSE −' : 'OPEN +'}</small>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div id={detailsId} className={styles.projectDetails}>
                          <div className={styles.upstreamRail}>
                            <span>{project.dossier.upstreamName}</span>
                            <span>{project.dossier.license}</span>
                            <span>{project.dossier.licenseStatus.toUpperCase()} LICENSE</span>
                            <span>{project.dossier.posture}</span>
                            <span>{STATUS_LABELS[project.status] || project.status.toUpperCase()}</span>
                          </div>

                          <div className={styles.projectReasoning}>
                            <section>
                              <h4>WHY IT MATTERS</h4>
                              <p>{project.dossier.whyItMatters}</p>
                            </section>
                            <section>
                              <h4>WHAT WE BUILD</h4>
                              <p>{project.dossier.buildProposal}</p>
                            </section>
                            <section>
                              <h4>FIRST MILESTONE · {project.dossier.effort}</h4>
                              <p>{project.dossier.firstMilestone}</p>
                            </section>
                          </div>

                          <details className={styles.researchNote}>
                            <summary>RESEARCH NOTE</summary>
                            <p>{project.dossier.researchNote}</p>
                          </details>

                          <footer className={styles.projectFooter}>
                            <div className={styles.sourceLinks}>
                              {project.sourceUrl ? (
                                <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer">
                                  SOURCE REPO ↗
                                </a>
                              ) : null}
                              {project.websiteUrl ? (
                                <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer">
                                  PROJECT SITE ↗
                                </a>
                              ) : null}
                            </div>

                            <div className={styles.interestPanel}>
                              <div className={styles.interestStats}>
                                <span>INTEREST</span>
                                <strong>{project.interest.totalScore}</strong>
                                <small>
                                  {project.interest.ratingCount > 0
                                    ? `${project.interest.averageScore}/5 · ${project.interest.ratingCount} PEOPLE`
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
                                      aria-label={`给 ${project.title} 评分 ${score}/5`}
                                      aria-pressed={project.interest.myScore === score}
                                      onClick={() => void setInterest(project.slug, score)}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </fieldset>
                            </div>
                          </footer>
                          <p className={styles.notice} aria-live="polite">
                            {notice || (project.interest.myScore
                              ? `YOUR SCORE ${project.interest.myScore}/5`
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
