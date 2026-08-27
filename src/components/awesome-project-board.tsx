'use client'

import React, { useEffect, useState } from 'react'
import {
  AWESOME_DIRECTIONS,
  type AwesomeDirection,
} from '@/content/awesome-projects'
import type {
  AwesomeInterestSummary,
  AwesomeProject,
} from '@/modules/candidate/awesome'
import styles from './awesome-project-board.module.css'

type AwesomeFilter = AwesomeDirection | 'all'

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
  filter: AwesomeFilter,
): AwesomeProject[] {
  return filter === 'all'
    ? projects
    : projects.filter((project) => project.dossier.direction === filter)
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
  const [filter, setFilter] = useState<AwesomeFilter>('all')
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
        setSyncNotice('无法同步你的历史评分；当前总榜仍可浏览。')
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

  const visibleProjects = filterAwesomeProjectCards(projects, filter)
  const ratedProjects = projects.filter((project) => project.interest.ratingCount > 0).length
  const totalSignal = projects.reduce((sum, project) => sum + project.interest.totalScore, 0)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1>AWESOME</h1>
          <div className={styles.statement}>
            <p>有价值，能落地，才进入队列。</p>
            <p>这里不是收藏夹。每条候选都连接一个真实开源上游、一项本站能力缺口和一个最小可交付。</p>
          </div>
        </div>
        <div className={styles.headerRail} aria-label="候选池状态">
          <span>{projects.length} CANDIDATES</span>
          <span>{ratedProjects} RATED</span>
          <span>{totalSignal} INTEREST POINTS</span>
          <strong>RANK = TOTAL INTEREST ↓</strong>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.filters} aria-label="候选方向筛选">
          <div className={styles.filterHeading}>
            <h2>DIRECTORY</h2>
            <span>{String(visibleProjects.length).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</span>
          </div>
          <div className={styles.filterList} role="group" aria-label="按方向筛选">
            <button
              type="button"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              <span>ALL DIRECTIONS</span>
              <small>{projects.length}</small>
            </button>
            {AWESOME_DIRECTIONS.map((direction) => {
              const count = projects.filter(
                (project) => project.dossier.direction === direction.id,
              ).length
              return (
                <button
                  key={direction.id}
                  type="button"
                  aria-pressed={filter === direction.id}
                  onClick={() => setFilter(direction.id)}
                >
                  <span>{direction.label}</span>
                  <small>{count}</small>
                </button>
              )
            })}
          </div>

          <section className={styles.criteria} aria-labelledby="awesome-criteria-title">
            <h2 id="awesome-criteria-title">ENTRY CRITERIA</h2>
            <ul>
              <li><span>01</span>解决真实、反复出现的问题</li>
              <li><span>02</span>有可检查的开源上游与许可</li>
              <li><span>03</span>能切成一项最小可交付</li>
              <li><span>04</span>完成后能沉淀为本站能力</li>
            </ul>
          </section>
        </aside>

        <section className={styles.queue} aria-labelledby="awesome-queue-title">
          <div className={styles.queueHeading}>
            <div>
              <h2 id="awesome-queue-title">PROJECT QUEUE</h2>
              <p>给真正想投入的方向打 1–5 分。总兴趣分更高的候选自动上浮。</p>
            </div>
            <span aria-live="polite">{syncNotice || 'COLLECTIVE SIGNAL / ONE SCORE PER PERSON'}</span>
          </div>

          {visibleProjects.length === 0 ? (
            <div className={styles.empty}>
              <strong>NO CANDIDATES IN THIS DIRECTION</strong>
              <p>切换到其他方向，或在 Candidate 中补充带有 awesome 标签的候选。</p>
            </div>
          ) : (
            <ol className={styles.ledger}>
              {visibleProjects.map((project) => {
                const globalRank = projects.findIndex((item) => item.slug === project.slug) + 1
                const isPending = pendingSlug === project.slug
                const notice = noticeBySlug[project.slug]

                return (
                  <li key={project.id} className={styles.project}>
                    <div className={styles.rank} aria-label={`当前总榜第 ${globalRank} 名`}>
                      <span>RANK</span>
                      <strong>{String(globalRank).padStart(2, '0')}</strong>
                    </div>

                    <article className={styles.projectBody}>
                      <header className={styles.projectHeader}>
                        <div>
                          <div className={styles.projectMeta}>
                            <span>{project.dossier.posture}</span>
                            <span>{STATUS_LABELS[project.status] || project.status.toUpperCase()}</span>
                            <span>{project.dossier.direction.replaceAll('-', ' ').toUpperCase()}</span>
                          </div>
                          <h3>{project.title}</h3>
                          <p>{project.summary}</p>
                        </div>
                        <div className={styles.upstream}>
                          <span>UPSTREAM</span>
                          <strong>{project.dossier.upstreamName}</strong>
                          <small>{project.dossier.license}</small>
                        </div>
                      </header>

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
                          : '选择 1–5，之后可以修改。')}
                      </p>
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
