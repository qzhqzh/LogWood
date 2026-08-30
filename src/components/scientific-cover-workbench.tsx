/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  Download,
  FileWarning,
  FlaskConical,
  Image as ImageIcon,
  LoaderCircle,
  Play,
  Plus,
  ShieldCheck,
  Square,
} from 'lucide-react'
import type {
  ScientificCoverProfileSummary,
  ScientificCoverRunSummary,
} from '@/modules/scientific-cover'
import styles from './scientific-cover-workbench.module.css'

type RunnerState = 'ready' | 'signin' | 'not-configured'
type CandidateRunState = 'idle' | 'running' | 'saved' | 'error'

export interface ScientificCoverModel {
  id: string
  label: string
  provider: string
  configured: boolean
}

interface ScientificCoverWorkbenchProps {
  profiles: ScientificCoverProfileSummary[]
  models: ScientificCoverModel[]
  runnerState: RunnerState
  signInHref: string
  initialRunId?: string
}

interface BriefDraft {
  profileId: string
  projectTitle: string
  articleType: string
  publisher: string
  journalName: string
  officialGuidelinesUrl: string
  claim: string
  novelty: string
  subjectName: string
  subjectRole: string
  outcomeName: string
  allowedRelationship: string
  mustShow: string
  mustNotShow: string
  uncertainties: string
  forbiddenInferences: string
  mood: string
  palette: string
  medium: string
  avoid: string
  concepts: Array<{ title: string; metaphor: string; mapping: string }>
  redactedConfirmed: boolean
  toolCommercialUseConfirmed: boolean
}

interface PromptRunResponse {
  error?: string
  kind?: 'text' | 'image'
  image?: {
    dataUrl: string
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
    width: number
    height: number
  }
  persisted?: boolean
  persistenceError?: string
  scientificCover?: {
    runId: string
    candidateId: string
    imageUrl: string | null
    status: string
    generatedCount: number
    contactSheetUrl: string | null
  }
}

const MAX_STREAM_CHARS = 25 * 1024 * 1024

const ERROR_COPY: Record<string, string> = {
  ERR_UNAUTHORIZED: '登录状态已失效，请重新登录。',
  ERR_FORBIDDEN: '当前账号没有封面生成权限。',
  ERR_VALIDATION: '简报没有通过校验；请检查必填项和文本长度。',
  ERR_SCIENTIFIC_COVER_NOT_FOUND: '找不到该运行，或它不属于当前账号。',
  ERR_SCIENTIFIC_COVER_BLOCKED: '目标期刊政策禁止调用生成式图像模型。',
  ERR_SCIENTIFIC_COVER_POLICY_EXPIRED: '期刊政策档案已过复核日期，请先重新核验。',
  ERR_SCIENTIFIC_COVER_CANDIDATE_EXISTS: '该候选已经保存，无需重复生成。',
  ERR_SCIENTIFIC_COVER_PROMPT_INTEGRITY: '登记提示词的完整性校验失败，生成已停止。',
  ERR_SCIENTIFIC_COVER_IMAGE_MODEL_REQUIRED: '封面候选必须使用图像模型。',
  ERR_SCIENTIFIC_COVER_PERSISTENCE: '图片已返回，但证据链保存失败；请先下载临时图再重试。',
  ERR_PROMPT_RUNNER_MODEL_NOT_ALLOWED: '所选模型不在服务器允许列表中。',
  ERR_PROMPT_RUNNER_NOT_CONFIGURED: '服务器尚未配置可用的图像模型。',
  ERR_PROMPT_RUNNER_AUTH: '模型凭据校验失败，请检查服务配置。',
  ERR_PROMPT_RUNNER_INVALID_RESPONSE: '模型没有返回有效图像。',
  ERR_PROMPT_RUNNER_UNAVAILABLE: '图像模型暂时不可用，请稍后重试。',
  ERR_PROMPT_RUNNER_CANCELLED: '本次生成已停止。',
}

const POLICY_LABELS: Record<ScientificCoverProfileSummary['policyState'], string> = {
  allowed: 'GENERATION ALLOWED',
  permission_required: 'PERMISSION REQUIRED',
  prohibited: 'GENERATION PROHIBITED',
  manual_review: 'MANUAL REVIEW',
}

const EMPTY_CONCEPTS = [
  { title: '', metaphor: '', mapping: '' },
  { title: '', metaphor: '', mapping: '' },
  { title: '', metaphor: '', mapping: '' },
]

function initialDraft(profileId: string): BriefDraft {
  return {
    profileId,
    projectTitle: '',
    articleType: 'Research Article',
    publisher: '',
    journalName: '',
    officialGuidelinesUrl: '',
    claim: '',
    novelty: '',
    subjectName: '',
    subjectRole: '',
    outcomeName: '',
    allowedRelationship: '',
    mustShow: '',
    mustNotShow: [
      '未被研究支持的因果关系',
      '定量比例、统计强度或精确空间结构',
      '任何看起来像原始实验图像的视觉',
    ].join('\n'),
    uncertainties: '',
    forbiddenInferences: [
      '不要暗示临床疗效或安全性结论',
      '不要把概念隐喻呈现为直接观测证据',
    ].join('\n'),
    mood: '克制\n精密\n具有编辑性',
    palette: 'deep emerald\nwarm ivory\ncontrolled amber accent',
    medium: 'layered editorial scientific illustration',
    avoid: '文字、数字、标签、坐标轴、公式、期刊标识、品牌、水印、写实人物',
    concepts: EMPTY_CONCEPTS.map((concept) => ({ ...concept })),
    redactedConfirmed: false,
    toolCommercialUseConfirmed: false,
  }
}

function draftFromSnapshot(snapshot: ScientificCoverRunSummary['brief']): BriefDraft {
  return {
    profileId: snapshot.profileId,
    projectTitle: snapshot.projectTitle,
    articleType: snapshot.articleType,
    publisher: snapshot.publisher,
    journalName: snapshot.journalName,
    officialGuidelinesUrl: snapshot.officialGuidelinesUrl,
    claim: snapshot.claim,
    novelty: snapshot.novelty,
    subjectName: snapshot.subjectName,
    subjectRole: snapshot.subjectRole,
    outcomeName: snapshot.outcomeName,
    allowedRelationship: snapshot.allowedRelationship,
    mustShow: snapshot.mustShow.join('\n'),
    mustNotShow: snapshot.mustNotShow.join('\n'),
    uncertainties: snapshot.uncertainties.join('\n'),
    forbiddenInferences: snapshot.forbiddenInferences.join('\n'),
    mood: snapshot.artDirection.mood.join('\n'),
    palette: snapshot.artDirection.palette.join('\n'),
    medium: snapshot.artDirection.medium.join('\n'),
    avoid: snapshot.artDirection.avoid.join('\n'),
    concepts: snapshot.concepts.map((concept) => ({ ...concept })),
    redactedConfirmed: snapshot.redactedConfirmed,
    toolCommercialUseConfirmed: snapshot.toolCommercialUseConfirmed,
  }
}

export function parseBriefList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function parseDirectionList(value: string) {
  return value
    .split(/\r?\n|[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function nextShortlist(current: string[], candidateId: string, limit = 2) {
  if (current.includes(candidateId)) return current.filter((id) => id !== candidateId)
  if (current.length >= limit) return current
  return [...current, candidateId]
}

function errorMessage(code?: string) {
  return (code && ERROR_COPY[code]) || '操作失败；现有运行记录没有被覆盖。'
}

async function readPromptRunResponse(response: Response): Promise<PromptRunResponse> {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    return await response.json().catch(() => ({ error: 'ERR_PROMPT_RUNNER_INVALID_RESPONSE' }))
  }
  if (!response.body) return { error: 'ERR_PROMPT_RUNNER_INVALID_RESPONSE' }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let receivedChars = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      receivedChars += chunk.length
      if (receivedChars > MAX_STREAM_CHARS) {
        await reader.cancel()
        return { error: 'ERR_PROMPT_RUNNER_INVALID_RESPONSE' }
      }
      buffer += chunk
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
        if (!frame || frame.startsWith(':')) continue

        let event = 'message'
        const data: string[] = []
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
        }
        if (event === 'status' || data.length === 0) continue
        try {
          const payload = JSON.parse(data.join('\n')) as PromptRunResponse
          if (event === 'error') return { error: payload.error || 'ERR_PROMPT_RUNNER_UNAVAILABLE' }
          if (event === 'result') return payload
        } catch {
          return { error: 'ERR_PROMPT_RUNNER_INVALID_RESPONSE' }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return { error: 'ERR_PROMPT_RUNNER_INVALID_RESPONSE' }
}

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return await response.json().catch(() => ({ error: 'ERR_SCIENTIFIC_COVER_INVALID_RESPONSE' }))
}

export function ScientificCoverWorkbench({
  profiles,
  models,
  runnerState,
  signInHref,
  initialRunId,
}: ScientificCoverWorkbenchProps) {
  const configuredModels = useMemo(() => models.filter((model) => model.configured), [models])
  const [draft, setDraft] = useState(() => initialDraft(profiles[0]?.id ?? ''))
  const [modelId, setModelId] = useState(configuredModels[0]?.id ?? '')
  const [run, setRun] = useState<ScientificCoverRunSummary | null>(null)
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null)
  const [candidateStates, setCandidateStates] = useState<Record<string, CandidateRunState>>({})
  const [transientImages, setTransientImages] = useState<Record<string, string>>({})
  const [shortlist, setShortlist] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [message, setMessage] = useState('先建立脱敏、可追溯的科研概念简报。')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stopBatchRef = useRef(false)

  const selectedProfile = profiles.find((profile) => profile.id === draft.profileId) ?? profiles[0]
  const activeCandidate = run?.candidates.find((candidate) => candidate.candidateId === activeCandidateId)
    ?? run?.candidates[0]
  const activeImageUrl = activeCandidate
    ? transientImages[activeCandidate.candidateId] || activeCandidate.imageUrl
    : null
  const generationAllowed = runnerState === 'ready' && Boolean(run?.policy.generationAllowed)

  useEffect(() => {
    if (!initialRunId || runnerState !== 'ready') return
    let cancelled = false
    void fetch(`/api/scientific-covers/runs/${encodeURIComponent(initialRunId)}`, {
      cache: 'no-store',
    }).then(async (response) => {
      const payload = await readJson<ScientificCoverRunSummary>(response)
      if (cancelled) return
      if (!response.ok || payload.error) {
        setError(errorMessage(payload.error))
        return
      }
      setRun(payload)
      setDraft(draftFromSnapshot(payload.brief))
      setActiveCandidateId(payload.candidates.find((candidate) => candidate.generated)?.candidateId
        ?? payload.candidates[0]?.candidateId
        ?? null)
      setMessage(`已恢复运行 ${payload.runId}。`)
    })
    return () => { cancelled = true }
  }, [initialRunId, runnerState])

  useEffect(() => () => abortRef.current?.abort(), [])

  function updateDraft<K extends keyof BriefDraft>(key: K, value: BriefDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateConcept(index: number, key: keyof BriefDraft['concepts'][number], value: string) {
    setDraft((current) => ({
      ...current,
      concepts: current.concepts.map((concept, conceptIndex) => (
        conceptIndex === index ? { ...concept, [key]: value } : concept
      )),
    }))
  }

  function replaceUrlRun(runId?: string) {
    const url = new URL(window.location.href)
    if (runId) url.searchParams.set('run', runId)
    else url.searchParams.delete('run')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }

  async function refreshRun(runId: string) {
    const response = await fetch(`/api/scientific-covers/runs/${encodeURIComponent(runId)}`, {
      cache: 'no-store',
    })
    const payload = await readJson<ScientificCoverRunSummary>(response)
    if (!response.ok || payload.error) throw new Error(payload.error || 'ERR_SCIENTIFIC_COVER_NOT_FOUND')
    setRun(payload)
    return payload
  }

  async function createRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (runnerState !== 'ready') return
    setCreating(true)
    setError(null)
    setMessage('正在登记简报、政策快照和六条精确提示词…')
    try {
      const response = await fetch('/api/scientific-covers/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: draft.profileId,
          projectTitle: draft.projectTitle,
          articleType: draft.articleType,
          publisher: draft.publisher,
          journalName: draft.journalName,
          officialGuidelinesUrl: draft.officialGuidelinesUrl,
          claim: draft.claim,
          novelty: draft.novelty,
          subjectName: draft.subjectName,
          subjectRole: draft.subjectRole,
          outcomeName: draft.outcomeName,
          allowedRelationship: draft.allowedRelationship,
          mustShow: parseBriefList(draft.mustShow),
          mustNotShow: parseBriefList(draft.mustNotShow),
          uncertainties: parseBriefList(draft.uncertainties),
          forbiddenInferences: parseBriefList(draft.forbiddenInferences),
          artDirection: {
            mood: parseDirectionList(draft.mood),
            palette: parseDirectionList(draft.palette),
            medium: parseDirectionList(draft.medium),
            avoid: parseDirectionList(draft.avoid),
          },
          concepts: draft.concepts,
          redactedConfirmed: draft.redactedConfirmed,
          toolCommercialUseConfirmed: draft.toolCommercialUseConfirmed,
        }),
      })
      const payload = await readJson<ScientificCoverRunSummary>(response)
      if (!response.ok || payload.error) throw new Error(payload.error || 'ERR_VALIDATION')
      setRun(payload)
      setDraft(draftFromSnapshot(payload.brief))
      setActiveCandidateId(payload.candidates[0]?.candidateId ?? null)
      setCandidateStates({})
      setTransientImages({})
      setShortlist([])
      replaceUrlRun(payload.runId)
      setMessage(payload.policy.generationAllowed
        ? '证据运行已建立。六张候选将按明确点击逐张生成。'
        : '证据运行已建立，但目标政策禁止调用生图模型；当前仅保留文字艺术指导。')
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : undefined
      setError(errorMessage(code))
      setMessage('简报未登记；请修正后重试。')
    } finally {
      setCreating(false)
    }
  }

  async function generateCandidate(candidateId: string, runId: string) {
    if (!modelId) return false
    const controller = new AbortController()
    let receivedTemporaryImage = false
    abortRef.current = controller
    setActiveCandidateId(candidateId)
    setCandidateStates((current) => ({ ...current, [candidateId]: 'running' }))
    setError(null)
    setMessage(`正在生成 ${candidateId}；完成后先写入证据链，再更新页面。`)
    try {
      const response = await fetch('/api/prompt-runs', {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          scientificCover: { runId, candidateId },
        }),
        signal: controller.signal,
      })
      const payload = await readPromptRunResponse(response)
      if (payload.image?.dataUrl) {
        receivedTemporaryImage = true
        setTransientImages((current) => ({ ...current, [candidateId]: payload.image!.dataUrl }))
      }
      if (!response.ok || payload.error) throw new Error(payload.error || 'ERR_PROMPT_RUNNER_UNAVAILABLE')
      if (payload.kind !== 'image' || !payload.image?.dataUrl) {
        throw new Error('ERR_PROMPT_RUNNER_INVALID_RESPONSE')
      }
      if (!payload.persisted) {
        throw new Error(payload.persistenceError || 'ERR_SCIENTIFIC_COVER_PERSISTENCE')
      }

      const nextRun = await refreshRun(runId)
      setTransientImages((current) => {
        const next = { ...current }
        delete next[candidateId]
        return next
      })
      setCandidateStates((current) => ({ ...current, [candidateId]: 'saved' }))
      setMessage(nextRun.generatedCount === 6
        ? '六张候选均已保存，初始联系表已经生成。现在只做人工短名单，不宣称投稿就绪。'
        : `${candidateId} 已保存并校验；${nextRun.generatedCount}/6。`)
      return true
    } catch (caught) {
      if (controller.signal.aborted) {
        setCandidateStates((current) => ({ ...current, [candidateId]: 'idle' }))
        setMessage('生成已停止；已完成的候选仍保留。')
        return false
      }
      const code = caught instanceof Error ? caught.message : undefined
      setCandidateStates((current) => ({ ...current, [candidateId]: 'error' }))
      setError(errorMessage(code))
      setMessage(receivedTemporaryImage
        ? '模型图像已返回但未能持久化；请下载临时图，证据链仍标记为未完成。'
        : '本张候选未保存；其他候选和运行记录不受影响。')
      return false
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  async function generateAll() {
    if (!run || batchRunning || !generationAllowed) return
    setBatchRunning(true)
    stopBatchRef.current = false
    try {
      for (const candidate of run.candidates) {
        if (stopBatchRef.current) break
        if (candidate.generated) continue
        const succeeded = await generateCandidate(candidate.candidateId, run.runId)
        if (!succeeded) break
      }
    } finally {
      setBatchRunning(false)
    }
  }

  function stopGeneration() {
    stopBatchRef.current = true
    abortRef.current?.abort()
  }

  function startNewBrief() {
    stopGeneration()
    setRun(null)
    setActiveCandidateId(null)
    setCandidateStates({})
    setTransientImages({})
    setShortlist([])
    setError(null)
    setMessage('已打开新简报；旧运行仍保留，可通过原链接恢复。')
    replaceUrlRun()
  }

  function toggleShortlist(candidateId: string) {
    const next = nextShortlist(shortlist, candidateId)
    if (next === shortlist) {
      setError('人工短名单最多保留两张；先取消一张再继续。')
      return
    }
    setError(null)
    setShortlist(next)
  }

  return (
    <section className={styles.shell} aria-label="Scientific cover proof press">
      <aside className={styles.briefPane} aria-labelledby="cover-brief-title">
        <header className={styles.paneHeader}>
          <p>01 / REDACTED BRIEF</p>
          <h1 id="cover-brief-title">SCIENTIFIC<br />COVER FORGE</h1>
          <span>CONCEPT ART · NOT RESEARCH DATA</span>
        </header>

        <form className={styles.briefForm} onSubmit={createRun}>
          <fieldset disabled={Boolean(run) || creating}>
            <details open>
              <summary>JOURNAL GATE</summary>
              <label>
                Policy profile
                <select
                  value={draft.profileId}
                  onChange={(event) => updateDraft('profileId', event.target.value)}
                  required
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.journal} · {profile.policyState}
                    </option>
                  ))}
                </select>
              </label>
              {selectedProfile && !selectedProfile.exactJournalProfile ? (
                <>
                  <label>
                    Exact publisher
                    <input
                      value={draft.publisher}
                      onChange={(event) => updateDraft('publisher', event.target.value)}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    Exact journal
                    <input
                      value={draft.journalName}
                      onChange={(event) => updateDraft('journalName', event.target.value)}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    Official guidelines URL
                    <input
                      type="url"
                      value={draft.officialGuidelinesUrl}
                      onChange={(event) => updateDraft('officialGuidelinesUrl', event.target.value)}
                      placeholder="https://official-publisher.example/guidelines"
                      required
                    />
                  </label>
                </>
              ) : null}
              <label>
                Project title
                <input
                  value={draft.projectTitle}
                  onChange={(event) => updateDraft('projectTitle', event.target.value)}
                  minLength={3}
                  maxLength={200}
                  placeholder="A short internal project title"
                  required
                />
              </label>
              <label>
                Article type
                <input
                  value={draft.articleType}
                  onChange={(event) => updateDraft('articleType', event.target.value)}
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>
            </details>

            <details open>
              <summary>SCIENTIFIC STORY</summary>
              <label>
                Supported claim
                <textarea
                  value={draft.claim}
                  onChange={(event) => updateDraft('claim', event.target.value)}
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  placeholder="Only the claim supported by the manuscript; no raw data or full unpublished text."
                  required
                />
              </label>
              <label>
                Novelty
                <textarea
                  value={draft.novelty}
                  onChange={(event) => updateDraft('novelty', event.target.value)}
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  required
                />
              </label>
              <div className={styles.fieldPair}>
                <label>
                  Central subject
                  <input
                    value={draft.subjectName}
                    onChange={(event) => updateDraft('subjectName', event.target.value)}
                    maxLength={200}
                    required
                  />
                </label>
                <label>
                  Outcome
                  <input
                    value={draft.outcomeName}
                    onChange={(event) => updateDraft('outcomeName', event.target.value)}
                    maxLength={200}
                    required
                  />
                </label>
              </div>
              <label>
                Subject role
                <textarea
                  value={draft.subjectRole}
                  onChange={(event) => updateDraft('subjectRole', event.target.value)}
                  maxLength={500}
                  rows={2}
                  required
                />
              </label>
              <label>
                Allowed relationship
                <textarea
                  value={draft.allowedRelationship}
                  onChange={(event) => updateDraft('allowedRelationship', event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="e.g. is associated with — do not strengthen causality"
                  required
                />
              </label>
            </details>

            <details>
              <summary>TRUTH BOUNDARY</summary>
              <p className={styles.formHint}>One constraint per line.</p>
              <label>
                Must show
                <textarea
                  value={draft.mustShow}
                  onChange={(event) => updateDraft('mustShow', event.target.value)}
                  rows={4}
                  required
                />
              </label>
              <label>
                Must not show
                <textarea
                  value={draft.mustNotShow}
                  onChange={(event) => updateDraft('mustNotShow', event.target.value)}
                  rows={5}
                  required
                />
              </label>
              <label>
                Uncertainties
                <textarea
                  value={draft.uncertainties}
                  onChange={(event) => updateDraft('uncertainties', event.target.value)}
                  rows={3}
                />
              </label>
              <label>
                Forbidden inferences
                <textarea
                  value={draft.forbiddenInferences}
                  onChange={(event) => updateDraft('forbiddenInferences', event.target.value)}
                  rows={4}
                  required
                />
              </label>
            </details>

            <details>
              <summary>ART DIRECTION</summary>
              <p className={styles.formHint}>Use a new line or comma between terms.</p>
              <label>
                Mood
                <textarea value={draft.mood} onChange={(event) => updateDraft('mood', event.target.value)} rows={3} required />
              </label>
              <label>
                Palette
                <textarea value={draft.palette} onChange={(event) => updateDraft('palette', event.target.value)} rows={3} required />
              </label>
              <label>
                Medium
                <textarea value={draft.medium} onChange={(event) => updateDraft('medium', event.target.value)} rows={2} required />
              </label>
              <label>
                Avoid
                <textarea value={draft.avoid} onChange={(event) => updateDraft('avoid', event.target.value)} rows={4} required />
              </label>
            </details>

            <details open>
              <summary>3 CONCEPTS × 2 COMPOSITIONS</summary>
              {draft.concepts.map((concept, index) => (
                <div className={styles.conceptBlock} key={index}>
                  <strong>C{index + 1}</strong>
                  <label>
                    Concept title
                    <input
                      value={concept.title}
                      onChange={(event) => updateConcept(index, 'title', event.target.value)}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    Editorial metaphor
                    <textarea
                      value={concept.metaphor}
                      onChange={(event) => updateConcept(index, 'metaphor', event.target.value)}
                      rows={3}
                      maxLength={1000}
                      required
                    />
                  </label>
                  <label>
                    Fact mapping
                    <textarea
                      value={concept.mapping}
                      onChange={(event) => updateConcept(index, 'mapping', event.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Map each visual element to a supported fact."
                      required
                    />
                  </label>
                </div>
              ))}
            </details>

            <div className={styles.confirmations}>
              <label>
                <input
                  type="checkbox"
                  checked={draft.redactedConfirmed}
                  onChange={(event) => updateDraft('redactedConfirmed', event.target.checked)}
                  required
                />
                <span>I confirm this brief is redacted: no raw data, primary research images, or unpublished full text.</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.toolCommercialUseConfirmed}
                  onChange={(event) => updateDraft('toolCommercialUseConfirmed', event.target.checked)}
                  required={selectedProfile?.toolCommercialUseConfirmationRequired}
                />
                <span>I confirmed the selected renderer permits commercial publication use.</span>
              </label>
            </div>
          </fieldset>

          {run ? (
            <button className={styles.secondaryButton} type="button" onClick={startNewBrief}>
              <Plus size={15} /> NEW BRIEF
            </button>
          ) : runnerState === 'signin' ? (
            <Link className={styles.primaryButton} href={signInHref}>
              SIGN IN TO INITIALIZE
            </Link>
          ) : (
            <button className={styles.primaryButton} type="submit" disabled={creating || runnerState !== 'ready'}>
              {creating ? <LoaderCircle className={styles.spin} size={16} /> : <ShieldCheck size={16} />}
              {runnerState === 'not-configured' ? 'IMAGE MODEL NOT CONFIGURED' : 'INITIALIZE EVIDENCE RUN'}
            </button>
          )}
        </form>
      </aside>

      <section className={styles.stagePane} aria-labelledby="cover-stage-title">
        <header className={styles.stageHeader}>
          <div>
            <p>02 / COVER PROOF</p>
            <h2 id="cover-stage-title">
              {activeCandidate?.conceptTitle ?? 'WAITING FOR A REGISTERED CONCEPT'}
            </h2>
          </div>
          <span data-state={activeCandidate?.generated ? 'saved' : candidateStates[activeCandidate?.candidateId ?? ''] ?? 'idle'}>
            {activeCandidate?.generated
              ? 'HASHED + SAVED'
              : candidateStates[activeCandidate?.candidateId ?? ''] === 'running'
                ? 'RENDERING'
                : 'CONCEPT PROOF'}
          </span>
        </header>

        <div className={styles.stageCanvas}>
          {activeImageUrl && activeCandidate ? (
            <figure>
              <img
                key={`${activeCandidate.candidateId}:${activeCandidate.generatedAt ?? 'temporary'}`}
                src={activeImageUrl}
                alt={`${activeCandidate.conceptTitle}, ${activeCandidate.compositionTitle} scientific cover concept`}
              />
              <figcaption>
                <span>{activeCandidate.candidateId.toUpperCase()}</span>
                <span>{activeCandidate.compositionTitle}</span>
                <span>{activeCandidate.generated ? 'PERSISTED EVIDENCE' : 'TEMPORARY · DOWNLOAD NOW'}</span>
              </figcaption>
            </figure>
          ) : (
            <div className={styles.emptyStage}>
              <FlaskConical aria-hidden="true" size={38} strokeWidth={1} />
              <p>REDACT → BIND POLICY → REGISTER PROMPTS</p>
              <strong>ONE SCIENTIFIC STORY<br />SIX CONTROLLED PROOFS</strong>
              <span>No model call occurs until you explicitly select GENERATE.</span>
            </div>
          )}
        </div>

        {run ? (
          <div className={styles.candidateRail} aria-label="Six initial cover candidates">
            {run.candidates.map((candidate, index) => {
              const preview = transientImages[candidate.candidateId] || candidate.imageUrl
              const state = candidate.generated ? 'saved' : candidateStates[candidate.candidateId] ?? 'idle'
              const selected = shortlist.includes(candidate.candidateId)
              return (
                <article
                  className={activeCandidate?.candidateId === candidate.candidateId ? styles.activeCandidate : ''}
                  key={candidate.candidateId}
                >
                  <button
                    className={styles.candidatePreview}
                    type="button"
                    onClick={() => setActiveCandidateId(candidate.candidateId)}
                    aria-label={`Inspect ${candidate.candidateId}`}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {preview ? (
                      <img src={preview} alt="" />
                    ) : (
                      <ImageIcon aria-hidden="true" size={19} strokeWidth={1} />
                    )}
                    <small data-state={state}>{state.toUpperCase()}</small>
                  </button>
                  <button
                    className={styles.shortlistButton}
                    type="button"
                    onClick={() => toggleShortlist(candidate.candidateId)}
                    disabled={!candidate.generated}
                    aria-pressed={selected}
                  >
                    {selected ? <Check size={13} /> : '+'} SHORTLIST
                  </button>
                </article>
              )
            })}
          </div>
        ) : null}

        <div className={styles.runControls}>
          <label>
            IMAGE MODEL
            <select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={batchRunning}>
              {configuredModels.length ? configuredModels.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              )) : <option value="">NO CONFIGURED IMAGE MODEL</option>}
            </select>
          </label>
          {runnerState === 'signin' ? (
            <Link className={styles.primaryButton} href={signInHref}>SIGN IN TO OPERATE</Link>
          ) : runnerState === 'not-configured' ? (
            <span className={styles.configurationSignal}>IMAGE MODEL NOT CONFIGURED</span>
          ) : batchRunning || candidateStates[activeCandidate?.candidateId ?? ''] === 'running' ? (
            <button className={styles.stopButton} type="button" onClick={stopGeneration}>
              <Square size={13} fill="currentColor" /> STOP
            </button>
          ) : (
            <>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => activeCandidate && run && void generateCandidate(activeCandidate.candidateId, run.runId)}
                disabled={!generationAllowed || !activeCandidate || activeCandidate.generated}
              >
                <Play size={14} /> GENERATE THIS
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => void generateAll()}
                disabled={!generationAllowed || !run || run.generatedCount === 6}
              >
                <Play size={14} fill="currentColor" /> GENERATE ALL REMAINING
              </button>
            </>
          )}
        </div>

        <div className={styles.liveRegion} aria-live="polite">
          <span>{message}</span>
          {error ? <strong><FileWarning size={14} /> {error}</strong> : null}
          {activeCandidate && transientImages[activeCandidate.candidateId] && !activeCandidate.generated ? (
            <a href={transientImages[activeCandidate.candidateId]} download={`${activeCandidate.candidateId}.png`}>
              <Download size={13} /> DOWNLOAD TEMPORARY IMAGE
            </a>
          ) : null}
        </div>
      </section>

      <aside className={styles.inspectorPane} aria-label="Policy and provenance inspector">
        <section>
          <p className={styles.sectionIndex}>03 / POLICY GATE</p>
          <div
            className={styles.policyBadge}
            data-policy={run?.policy.effectiveState ?? selectedProfile?.policyState}
          >
            <ShieldCheck size={18} />
            <span>{run
              ? run.policy.generationAllowed ? 'MODEL CALL CHECKED' : 'MODEL CALL BLOCKED'
              : selectedProfile ? POLICY_LABELS[selectedProfile.policyState] : 'NO PROFILE'}</span>
          </div>
          <dl className={styles.factList}>
            <div><dt>JOURNAL</dt><dd>{run?.policy.journal ?? selectedProfile?.journal ?? '—'}</dd></div>
            <div><dt>PUBLISHER</dt><dd>{run?.policy.publisher ?? selectedProfile?.publisher ?? '—'}</dd></div>
            <div><dt>PROFILE</dt><dd>{run?.policy.profileId ?? selectedProfile?.id ?? '—'}</dd></div>
            <div><dt>REVIEW AFTER</dt><dd>{run?.policy.reviewAfter ?? selectedProfile?.reviewAfter ?? '—'}</dd></div>
          </dl>
          {run?.policy.reasons.length ? (
            <ul className={styles.reasonList}>
              {run.policy.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : selectedProfile && selectedProfile.policyState !== 'allowed' ? (
            <p className={styles.warningSignal}>
              {POLICY_LABELS[selectedProfile.policyState]} · INITIALIZE THE RUN TO SNAPSHOT FULL REASONS
            </p>
          ) : <p className={styles.clearSignal}>NO ACTIVE POLICY BLOCKERS</p>}
          <div className={styles.sourceLinks}>
            {(run?.policy.sourceUrls ?? selectedProfile?.sourceUrls ?? []).map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">SOURCE {String(index + 1).padStart(2, '0')} ↗</a>
            ))}
          </div>
        </section>

        <section>
          <p className={styles.sectionIndex}>04 / TECHNICAL TARGET</p>
          {(run?.policy.spec ?? selectedProfile?.spec) ? (
            <dl className={styles.factList}>
              <div><dt>MIN PIXELS</dt><dd>{(run?.policy.spec ?? selectedProfile?.spec)!.width} × {(run?.policy.spec ?? selectedProfile?.spec)!.height}</dd></div>
              <div><dt>DENSITY</dt><dd>{(run?.policy.spec ?? selectedProfile?.spec)!.dpi} DPI</dd></div>
              <div><dt>PHYSICAL</dt><dd>{(run?.policy.spec ?? selectedProfile?.spec)!.physical}</dd></div>
              <div><dt>FORMATS</dt><dd>{(run?.policy.spec ?? selectedProfile?.spec)!.acceptedFormats.join(' / ').toUpperCase()}</dd></div>
              <div><dt>SAFE AREA</dt><dd>{(run?.policy.spec ?? selectedProfile?.spec)!.safeAreaLabels.join('; ') || 'NO PROFILE OVERLAY'}</dd></div>
            </dl>
          ) : (
            <p className={styles.warningSignal}>EXACT EXPORT SPEC NOT VERIFIED · CONCEPT ONLY</p>
          )}
        </section>

        <section>
          <p className={styles.sectionIndex}>05 / PROVENANCE</p>
          {activeCandidate?.generated ? (
            <dl className={styles.factList}>
              <div><dt>PROVIDER</dt><dd>{activeCandidate.provider}</dd></div>
              <div><dt>MODEL</dt><dd>{activeCandidate.model}</dd></div>
              <div><dt>VERSION</dt><dd>{activeCandidate.modelVersion}</dd></div>
              <div><dt>REQUEST</dt><dd>{activeCandidate.providerRequestId ?? 'NOT EXPOSED'}</dd></div>
              <div><dt>ACTUAL</dt><dd>{activeCandidate.actual?.width} × {activeCandidate.actual?.height} · {activeCandidate.actual?.format.toUpperCase()}</dd></div>
              <div><dt>GENERATED</dt><dd>{activeCandidate.generatedAt}</dd></div>
            </dl>
          ) : (
            <p className={styles.mutedSignal}>NO GENERATED CANDIDATE SELECTED</p>
          )}
        </section>

        <section>
          <p className={styles.sectionIndex}>06 / HUMAN SHORTLIST</p>
          <strong className={styles.draftChoice}>DRAFT CHOICE · {shortlist.length}/2</strong>
          <p className={styles.inspectorCopy}>
            This local shortlist is not a scientific review, approval record, or final selection.
          </p>
          {shortlist.length ? (
            <ol className={styles.shortlist}>
              {shortlist.map((candidateId) => <li key={candidateId}>{candidateId}</li>)}
            </ol>
          ) : null}
          {run?.contactSheetUrl ? (
            <a className={styles.downloadButton} href={run.contactSheetUrl} download>
              <Download size={14} /> DOWNLOAD 6-UP CONTACT SHEET
            </a>
          ) : null}
        </section>

        {run ? (
          <section>
            <p className={styles.sectionIndex}>RUN RECORD</p>
            <dl className={styles.factList}>
              <div><dt>ID</dt><dd>{run.runId}</dd></div>
              <div><dt>STATE</dt><dd>{run.status}</dd></div>
              <div><dt>SAVED</dt><dd>{run.generatedCount}/6</dd></div>
              <div><dt>PATH</dt><dd>{run.runPath}</dd></div>
            </dl>
            <code className={styles.command}>{run.continuationCommand}</code>
          </section>
        ) : null}
      </aside>
    </section>
  )
}
