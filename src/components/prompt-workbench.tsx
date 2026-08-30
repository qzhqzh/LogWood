'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ClipboardPaste,
  Compass,
  ExternalLink,
  ImagePlus,
  LogIn,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { isRunnablePromptOutput } from '@/modules/skill/constants'
import type { PromptOutputKind } from '@/modules/skill/constants'

export interface PromptWorkbenchItem {
  id: string
  slug: string
  title: string
  categoryLabel: string
  summary: string | null
  prompt: string
  effectImageUrl: string | null
  effectNote: string | null
  outputKind: PromptOutputKind
  updatedAt: string
  recordType?: 'skill' | 'candidate'
  recordStatus?: 'published' | 'draft'
  tags?: string[]
}

export interface PromptWorkbenchModel {
  id: string
  label: string
  provider: string
  outputType: 'text' | 'image'
  configured: boolean
}

type RunnerState = 'ready' | 'signin' | 'not-configured'
type MobileView = 'output' | 'prompts' | 'edit'
type RunStatus = 'idle' | 'running' | 'complete' | 'error'

interface PromptRunResultBase {
  requestId?: string
  sourcePrompt: string
  attribution: {
    provider: string
    model: string
    modelVersion: string
    generatedAt: string
  }
}

interface PromptTextRunResult extends PromptRunResultBase {
  kind: 'text'
  output: string
}

interface PromptImageRunResult extends PromptRunResultBase {
  kind: 'image'
  image: {
    dataUrl: string
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
    width: number
    height: number
  }
}

type PromptRunResult = PromptTextRunResult | PromptImageRunResult

interface PromptRunResponseBody {
  error?: string
  kind?: 'text' | 'image'
  output?: string
  image?: PromptImageRunResult['image']
  requestId?: string
  attribution?: PromptRunResult['attribution']
}

interface PromptWorkbenchProps {
  prompts: PromptWorkbenchItem[]
  models: PromptWorkbenchModel[]
  initialSlug?: string
  initialDraftSlug?: string
  runnerState: RunnerState
  signInHref: string
  canManage?: boolean
}

const ERROR_COPY: Record<string, string> = {
  ERR_UNAUTHORIZED: '登录状态已失效，请重新登录后再运行。',
  ERR_FORBIDDEN: '当前账号没有模型测试权限。',
  ERR_PROMPT_RUNNER_MODEL_NOT_ALLOWED: '该模型不在服务器允许列表中，请重新选择。',
  ERR_PROMPT_RUNNER_NOT_CONFIGURED: '服务器尚未配置可用模型。',
  ERR_PROMPT_RUNNER_AUTH: '模型凭据校验失败，请检查服务配置。',
  ERR_PROMPT_RUNNER_INVALID_RESPONSE: '模型没有返回可展示的结果，可以重试。',
  ERR_PROMPT_RUNNER_UNAVAILABLE: '模型暂时不可用，请稍后重试。',
  ERR_PROMPT_RUNNER_VALIDATION: '提示词为空或超过 12000 字符。',
  ERR_PROMPT_RUNNER_CANCELLED: '本次模型请求已取消，请重新运行。',
}

const MAX_STREAM_CHARS = 25 * 1024 * 1024
const MAX_EFFECT_IMAGE_BYTES = 5 * 1024 * 1024
const EFFECT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
type PromptGroup = 'all' | 'image' | 'text' | 'managed'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const PROMPT_GROUPS: Array<{ id: PromptGroup; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'image', label: 'IMAGE' },
  { id: 'text', label: 'TEXT' },
  { id: 'managed', label: 'MANAGED' },
]

const CREATIVE_REFERENCE_GROUPS = [
  {
    title: 'PROMPT RESOURCES',
    description: 'Search, reverse, and study reproducible creative prompts.',
    links: [
      {
        label: 'PromptHero',
        host: 'PROMPTHERO.COM',
        href: 'https://prompthero.com/',
        note: 'Model-sorted prompt discovery',
      },
      {
        label: 'Civitai Images',
        host: 'CIVITAI.COM',
        href: 'https://civitai.com/images',
        note: 'Prompt, model, seed & workflow metadata',
      },
      {
        label: 'OpenArt',
        host: 'OPENART.AI',
        href: 'https://openart.ai/features/image-to-prompt/',
        note: 'Reference image to draft prompt',
      },
      {
        label: 'Gamma',
        host: 'GAMMA.APP',
        href: 'https://gamma.app/templates',
        note: 'Deck prompts and use-case templates',
      },
      {
        label: 'Beautiful.ai',
        host: 'BEAUTIFUL.AI',
        href: 'https://www.beautiful.ai/slide-templates',
        note: 'Reusable slide pattern library',
      },
    ],
  },
  {
    title: 'AESTHETIC REFERENCES',
    description: 'Browse visual languages, moodboards, and client-ready systems.',
    links: [
      {
        label: 'Recraft Community',
        host: 'RECRAFT.AI',
        href: 'https://www.recraft.ai/community',
        note: 'Prompt-visible visual community',
      },
      {
        label: 'Midjourney Explore',
        host: 'MIDJOURNEY.COM',
        href: 'https://www.midjourney.com/explore',
        note: 'High-volume visual discovery',
      },
      {
        label: 'Krea',
        host: 'KREA.AI',
        href: 'https://www.krea.ai/krea-2',
        note: 'Moodboards and style-reference studies',
      },
      {
        label: 'Pitch',
        host: 'PITCH.COM',
        href: 'https://pitch.com/templates',
        note: 'Client-ready presentation systems',
      },
      {
        label: 'Canva Presentations',
        host: 'CANVA.COM',
        href: 'https://www.canva.com/presentations/templates/',
        note: 'Broad presentation style taxonomy',
      },
    ],
  },
  {
    title: 'UI / ICON LIBRARIES',
    description: 'Study reusable icon systems, liquid interfaces, and interaction motion.',
    links: [
      {
        label: 'Morphicons',
        host: 'JAMECLING.COM',
        href: 'https://www.jamecling.com/archives/5546',
        note: 'Open-source SVG icon morphing library',
      },
      {
        label: 'Liquid Gooey',
        host: 'GOOEY.JAKUBANTALIK.COM',
        href: 'https://gooey.jakubantalik.com/',
        note: 'Liquid Morph & Move effects for React',
      },
    ],
  },
  {
    title: 'CREATIVE TOOLS',
    description: 'Process visual assets with private, browser-side utilities.',
    links: [
      {
        label: 'Image Master',
        host: 'IMAGE.MOONRAILGUN.COM',
        href: 'https://image.moonrailgun.com/',
        note: 'Cutout, upscale, compress, crop & vectorize',
      },
    ],
  },
  {
    title: 'GAME ART ASSETS',
    description: 'Browse 2D, 3D, UI, and texture packs. Verify every asset license.',
    links: [
      {
        label: 'Kenney Assets',
        host: 'KENNEY.NL',
        href: 'https://kenney.nl/assets/',
        note: '2D, 3D, UI & audio packs · CC0',
      },
      {
        label: 'itch.io Assets',
        host: 'ITCH.IO',
        href: 'https://itch.io/game-assets',
        note: 'Indie packs · verify each creator license',
      },
      {
        label: 'OpenGameArt',
        host: 'OPENGAMEART.ORG',
        href: 'https://opengameart.org/',
        note: 'Community art · mixed open licenses',
      },
      {
        label: 'CraftPix',
        host: 'CRAFTPIX.NET',
        href: 'https://craftpix.net/',
        note: '2D packs · commercial use, no AI training',
      },
      {
        label: 'Quaternius',
        host: 'QUATERNIUS.COM',
        href: 'https://quaternius.com/',
        note: 'Stylized 3D packs & animation · CC0',
      },
      {
        label: 'Poly Haven',
        host: 'POLYHAVEN.COM',
        href: 'https://polyhaven.com/',
        note: 'HDRIs, textures & 3D models · CC0',
      },
      {
        label: 'Game Icons',
        host: 'GAME-ICONS.NET',
        href: 'https://game-icons.net/',
        note: 'SVG & PNG game icons · CC BY 3.0',
      },
    ],
  },
] as const

function runErrorMessage(code?: string) {
  return (code && ERROR_COPY[code]) || '本次测试失败，请稍后重试。'
}

export async function readPromptRunResponse(response: Response): Promise<PromptRunResponseBody | null> {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    return response.json().catch(() => null) as Promise<PromptRunResponseBody | null>
  }
  if (!response.body) throw new Error('ERR_PROMPT_RUNNER_INVALID_RESPONSE')

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
        throw new Error('ERR_PROMPT_RUNNER_INVALID_RESPONSE')
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
          if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
          if (line.startsWith('data:')) data.push(line.slice('data:'.length).trimStart())
        }
        if (data.length === 0 || event === 'status') continue

        let payload: PromptRunResponseBody | null = null
        try {
          payload = JSON.parse(data.join('\n')) as PromptRunResponseBody
        } catch {
          throw new Error('ERR_PROMPT_RUNNER_INVALID_RESPONSE')
        }
        if (event === 'error') throw new Error(payload?.error || 'ERR_PROMPT_RUNNER_UNAVAILABLE')
        if (event === 'result') return payload
      }
    }
  } finally {
    reader.releaseLock()
  }

  throw new Error('ERR_PROMPT_RUNNER_INVALID_RESPONSE')
}

export function preferredModelId(
  prompt: Pick<PromptWorkbenchItem, 'outputKind'> | undefined,
  models: PromptWorkbenchModel[],
) {
  if (!prompt || !isRunnablePromptOutput(prompt.outputKind)) return ''
  const compatible = models.filter((model) => model.outputType === prompt.outputKind)
  return compatible.find((model) => model.configured)?.id ?? compatible[0]?.id ?? ''
}

export function initialWorkbenchPrompt(
  prompts: PromptWorkbenchItem[],
  initialSlug?: string,
) {
  const published = prompts.filter((prompt) => (prompt.recordType ?? 'skill') === 'skill')
  const pool = published.length > 0 ? published : prompts
  return pool.find((prompt) => prompt.slug === initialSlug)
    ?? pool.find((prompt) => prompt.outputKind === 'image' && Boolean(prompt.effectImageUrl))
    ?? pool.find((prompt) => Boolean(prompt.effectImageUrl))
    ?? pool[0]
}

const OUTPUT_KIND_COPY: Record<PromptOutputKind, string> = {
  text: 'TEXT',
  image: 'IMAGE',
  document: 'DOCUMENT',
  video: 'VIDEO',
  other: 'SPECIAL',
}

function workbenchRecordKey(prompt: PromptWorkbenchItem): string {
  return `${prompt.recordType ?? 'skill'}:${prompt.id}`
}

export function filterWorkbenchPrompts(
  prompts: PromptWorkbenchItem[],
  filter: string,
  group: PromptGroup,
) {
  const needle = filter.trim().toLocaleLowerCase('zh-CN')
  return prompts.filter((prompt) => {
    const groupMatches = group === 'all'
      || prompt.outputKind === group
      || (group === 'managed' && !isRunnablePromptOutput(prompt.outputKind))
    if (!groupMatches) return false
    if (!needle) return true
    return `${prompt.title} ${prompt.categoryLabel} ${OUTPUT_KIND_COPY[prompt.outputKind]} ${prompt.summary ?? ''}`
      .toLocaleLowerCase('zh-CN')
      .includes(needle)
  })
}

export function clipboardImageFile(items: ArrayLike<DataTransferItem>): File | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (item.kind !== 'file' || !EFFECT_IMAGE_TYPES.has(item.type)) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}

function outputKindTag(outputKind: PromptOutputKind) {
  return `output:${outputKind}`
}

export function PromptWorkbench({
  prompts,
  models,
  initialSlug,
  initialDraftSlug,
  runnerState,
  signInHref,
  canManage = false,
}: PromptWorkbenchProps) {
  const explicitDraft = prompts.find((prompt) => (
    prompt.recordType === 'candidate' && prompt.slug === initialDraftSlug
  ))
  const initialPrompt = explicitDraft ?? initialWorkbenchPrompt(prompts, initialSlug)
  const [library, setLibrary] = useState(prompts)
  const [selectedKey, setSelectedKey] = useState(initialPrompt ? workbenchRecordKey(initialPrompt) : '')
  const [editorValue, setEditorValue] = useState(initialPrompt?.prompt ?? '')
  const [modelId, setModelId] = useState(preferredModelId(initialPrompt, models))
  const [filter, setFilter] = useState('')
  const [group, setGroup] = useState<PromptGroup>('all')
  const [mobileView, setMobileView] = useState<MobileView>('output')
  const [referencesOpen, setReferencesOpen] = useState(false)
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [runResult, setRunResult] = useState<PromptRunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState(!initialPrompt && canManage)
  const [draftTitle, setDraftTitle] = useState('Untitled Capture')
  const [draftNote, setDraftNote] = useState('')
  const [draftOutputKind, setDraftOutputKind] = useState<PromptOutputKind>('image')
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const selected = library.find((prompt) => workbenchRecordKey(prompt) === selectedKey)
    ?? initialWorkbenchPrompt(library)
  const activeOutputKind = captureMode ? draftOutputKind : selected?.outputKind ?? 'image'
  const selectedIsRunnable = Boolean(selected && isRunnablePromptOutput(selected.outputKind))
  const compatibleModels = selected && isRunnablePromptOutput(selected.outputKind)
    ? models.filter((model) => model.outputType === selected.outputKind)
    : []
  const selectedModel = compatibleModels.find((model) => model.id === modelId)
  const visiblePrompts = useMemo(
    () => filterWorkbenchPrompts(library, filter, group),
    [filter, group, library],
  )
  const hasChanges = Boolean(selected && editorValue !== selected.prompt)
  const resultIsStale = Boolean(runResult && runResult.sourcePrompt !== editorValue.trim())
  const canRun = !captureMode
    && runnerState === 'ready'
    && selectedIsRunnable
    && Boolean(selectedModel?.configured)
    && editorValue.trim().length > 0
  const needsSignInForRun = Boolean(
    !captureMode
    && runnerState === 'signin'
    && selectedIsRunnable,
  )
  const canSaveNewDraft = canManage
    && draftTitle.trim().length >= 2
    && Boolean(pendingImageFile || editorValue.trim())
  const canSaveCandidateDraft = Boolean(
    canManage
    && selected?.recordType === 'candidate'
    && (hasChanges || pendingImageFile),
  )

  useEffect(() => () => {
    abortRef.current?.abort()
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  function clearPendingImage() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setPendingImageFile(null)
    setPendingImageUrl(null)
  }

  function resetRunState() {
    abortRef.current?.abort()
    setRunStatus('idle')
    setRunResult(null)
    setRunError(null)
  }

  function acceptEffectFile(file: File) {
    if (!EFFECT_IMAGE_TYPES.has(file.type)) {
      setSaveStatus('error')
      setSaveMessage('仅支持 JPEG、PNG 或 WebP 图片。')
      return
    }
    if (file.size === 0 || file.size > MAX_EFFECT_IMAGE_BYTES) {
      setSaveStatus('error')
      setSaveMessage('图片必须小于 5MB；请压缩后重试。')
      return
    }

    clearPendingImage()
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setPendingImageFile(file)
    setPendingImageUrl(objectUrl)
    setSaveStatus('idle')
    setSaveMessage('图片只在本地预览；保存前不会更新记录。')
    resetRunState()
    setMobileView('output')
  }

  function handlePaste(event: React.ClipboardEvent<HTMLElement>) {
    if (!canManage) return
    const file = clipboardImageFile(event.clipboardData.items)
    if (!file) return
    event.preventDefault()
    acceptEffectFile(file)
  }

  async function readImageFromClipboard() {
    if (!canManage) return
    if (!navigator.clipboard?.read) {
      setSaveStatus('error')
      setSaveMessage('浏览器不支持读取剪切板；请直接按 Ctrl/Cmd+V 或选择图片。')
      return
    }

    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => EFFECT_IMAGE_TYPES.has(type))
        if (!imageType) continue
        const blob = await item.getType(imageType)
        const extension = imageType.split('/')[1].replace('jpeg', 'jpg')
        acceptEffectFile(new File(
          [blob],
          `clipboard-${Date.now()}.${extension}`,
          { type: imageType },
        ))
        return
      }
      setSaveStatus('error')
      setSaveMessage('剪切板中没有可读取的图片。')
    } catch {
      setSaveStatus('error')
      setSaveMessage('剪切板权限未开放；请按 Ctrl/Cmd+V 或选择图片。')
    }
  }

  function selectPrompt(prompt: PromptWorkbenchItem) {
    resetRunState()
    clearPendingImage()
    setCaptureMode(false)
    setSelectedKey(workbenchRecordKey(prompt))
    setEditorValue(prompt.prompt)
    setModelId(preferredModelId(prompt, models))
    setSaveStatus('idle')
    setSaveMessage('')
    setMobileView('output')

    const url = new URL(window.location.href)
    if (prompt.recordType === 'candidate') {
      url.searchParams.delete('prompt')
      url.searchParams.set('draft', prompt.slug)
    } else {
      url.searchParams.delete('draft')
      url.searchParams.set('prompt', prompt.slug)
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }

  function startCapture() {
    resetRunState()
    clearPendingImage()
    setCaptureMode(true)
    setDraftTitle('Untitled Capture')
    setDraftNote('')
    setDraftOutputKind('image')
    setEditorValue('')
    setModelId('')
    setSaveStatus('idle')
    setSaveMessage('Paste a screenshot now. Add the prompt when it is ready.')
    setMobileView('output')

    const url = new URL(window.location.href)
    url.searchParams.delete('prompt')
    url.searchParams.delete('draft')
    window.history.replaceState(window.history.state, '', url.pathname)
  }

  function cancelCapture() {
    clearPendingImage()
    setCaptureMode(false)
    setEditorValue(selected?.prompt ?? '')
    setModelId(preferredModelId(selected, models))
    setSaveStatus('idle')
    setSaveMessage('')
    setMobileView(selected ? 'output' : 'prompts')
  }

  function resetEditor() {
    if (!selected) return
    resetRunState()
    setEditorValue(selected.prompt)
  }

  function updateLibraryEffect(record: PromptWorkbenchItem, effectImageUrl: string) {
    setLibrary((current) => current.map((item) => (
      workbenchRecordKey(item) === workbenchRecordKey(record)
        ? { ...item, effectImageUrl }
        : item
    )))
  }

  async function persistPendingEffect(record: PromptWorkbenchItem) {
    if (!pendingImageFile) return record.effectImageUrl
    const form = new FormData()
    form.set('file', pendingImageFile)
    form.set('recordType', record.recordType ?? 'skill')
    form.set('recordId', record.id)
    if (record.effectNote) form.set('effectNote', record.effectNote)

    const response = await fetch('/api/uploads/skill-effect', {
      method: 'POST',
      body: form,
    })
    const payload = await response.json().catch(() => ({})) as { error?: string; url?: string }
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || 'ERR_EFFECT_SAVE_FAILED')
    }

    updateLibraryEffect(record, payload.url)
    clearPendingImage()
    return payload.url
  }

  async function savePendingEffect() {
    if (!selected || !pendingImageFile || saveStatus === 'saving') return
    setSaveStatus('saving')
    setSaveMessage('正在校验并保存效果图…')
    try {
      await persistPendingEffect(selected)
      setSaveStatus('saved')
      setSaveMessage('效果图已保存；旧文件保留，可审计回退。')
    } catch {
      setSaveStatus('error')
      setSaveMessage('效果图保存失败，当前记录未被覆盖；请重试。')
    }
  }

  async function saveCandidateDraft() {
    if (!selected || selected.recordType !== 'candidate' || !canSaveCandidateDraft) return
    setSaveStatus('saving')
    setSaveMessage('正在保存私有草稿…')
    let effectSaved = false
    try {
      if (pendingImageFile) {
        await persistPendingEffect(selected)
        effectSaved = true
      }
      const response = await fetch('/api/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft-content',
          id: selected.id,
          rawContent: editorValue,
        }),
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: string
        candidate?: { rawContent?: string | null; updatedAt?: string }
      }
      if (!response.ok || !payload.candidate) {
        throw new Error(payload.error || 'ERR_DRAFT_SAVE_FAILED')
      }
      setLibrary((current) => current.map((item) => (
        workbenchRecordKey(item) === workbenchRecordKey(selected)
          ? {
              ...item,
              prompt: payload.candidate?.rawContent ?? '',
              updatedAt: payload.candidate?.updatedAt ?? item.updatedAt,
            }
          : item
      )))
      setSaveStatus('saved')
      setSaveMessage('私有草稿已保存；未进入公开 Prompt 库。')
    } catch {
      setSaveStatus('error')
      setSaveMessage(effectSaved
        ? '图片已保存，但正文保存失败；正文仍保留在编辑器中，请重试。'
        : '草稿保存失败，数据库内容未被覆盖；请重试。')
    }
  }

  async function saveNewDraft() {
    if (!canSaveNewDraft || saveStatus === 'saving') return
    setSaveStatus('saving')
    setSaveMessage('正在创建私有 Candidate 草稿…')
    try {
      let response: Response
      const tags = [outputKindTag(draftOutputKind)]
      if (pendingImageFile) {
        const form = new FormData()
        form.set('file', pendingImageFile)
        form.set('title', draftTitle.trim())
        form.set('note', draftNote.trim())
        form.set('prompt', editorValue)
        form.set('privateDraft', '1')
        form.set('tags', tags.join(','))
        response = await fetch('/api/candidates/image', { method: 'POST', body: form })
      } else {
        response = await fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draftTitle.trim(),
            summary: draftNote.trim() || undefined,
            rawContent: editorValue,
            tags,
            visibility: 'private',
          }),
        })
      }

      const payload = await response.json().catch(() => ({})) as {
        error?: string
        candidate?: {
          id: string
          slug: string
          title: string
          summary?: string | null
          rawContent?: string | null
          previewImageUrl?: string | null
          updatedAt: string
        }
      }
      if (!response.ok || !payload.candidate) {
        throw new Error(payload.error || 'ERR_DRAFT_CREATE_FAILED')
      }

      const candidate = payload.candidate
      const nextItem: PromptWorkbenchItem = {
        id: candidate.id,
        slug: candidate.slug,
        title: candidate.title,
        categoryLabel: 'DRAFT',
        summary: candidate.summary ?? null,
        prompt: candidate.rawContent ?? '',
        effectImageUrl: candidate.previewImageUrl ?? null,
        effectNote: candidate.summary ?? null,
        outputKind: draftOutputKind,
        updatedAt: candidate.updatedAt,
        recordType: 'candidate',
        recordStatus: 'draft',
        tags: [],
      }
      setLibrary((current) => [nextItem, ...current])
      setSelectedKey(workbenchRecordKey(nextItem))
      setEditorValue(nextItem.prompt)
      setModelId(preferredModelId(nextItem, models))
      clearPendingImage()
      setCaptureMode(false)
      setSaveStatus('saved')
      setSaveMessage('私有草稿已保存；补完并验证前不会公开。')

      const url = new URL(window.location.href)
      url.searchParams.delete('prompt')
      url.searchParams.set('draft', nextItem.slug)
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    } catch {
      setSaveStatus('error')
      setSaveMessage('草稿创建失败；本地内容仍在，没有写入不完整记录。')
    }
  }

  async function runPrompt() {
    if (!selected || !isRunnablePromptOutput(selected.outputKind)) {
      setRunError(null)
      setRunStatus('idle')
      setMobileView('output')
      return
    }
    if (!canRun) {
      setRunError(runnerState === 'signin'
        ? '登录管理员账号后才能调用真实模型。'
        : `服务器尚未配置可用的${selected.outputKind === 'image' ? '生图' : '文本'}模型。`)
      setRunStatus('error')
      setMobileView('output')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const submittedPrompt = editorValue.trim()
    setRunStatus('running')
    setRunResult(null)
    setRunError(null)
    setSaveStatus('idle')
    setMobileView('output')

    try {
      const response = await fetch('/api/prompt-runs', {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: submittedPrompt, model: modelId }),
        signal: controller.signal,
      })
      const body = await readPromptRunResponse(response)

      if (!response.ok || !body?.kind || !body.attribution) {
        throw new Error(body?.error || 'ERR_PROMPT_RUNNER_UNAVAILABLE')
      }
      if (body.kind === 'image') {
        if (
          !body.image?.dataUrl.match(/^data:image\/(?:jpeg|png|webp);base64,/)
          || body.image.width < 1
          || body.image.height < 1
        ) {
          throw new Error('ERR_PROMPT_RUNNER_INVALID_RESPONSE')
        }
        setRunResult({
          kind: 'image',
          image: body.image,
          requestId: body.requestId,
          attribution: body.attribution,
          sourcePrompt: submittedPrompt,
        })
      } else {
        if (!body.output) throw new Error('ERR_PROMPT_RUNNER_INVALID_RESPONSE')
        setRunResult({
          kind: 'text',
          output: body.output,
          requestId: body.requestId,
          attribution: body.attribution,
          sourcePrompt: submittedPrompt,
        })
      }
      setRunStatus('complete')
    } catch (error) {
      if (controller.signal.aborted) return
      setRunError(runErrorMessage(error instanceof Error ? error.message : undefined))
      setRunStatus('error')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const stageState = captureMode
    ? pendingImageFile ? 'UNSAVED CAPTURE' : 'NEW DRAFT'
    : pendingImageFile
      ? 'UNSAVED EFFECT'
      : runStatus === 'running'
        ? 'RUNNING'
        : runStatus === 'error'
          ? 'ERROR'
          : resultIsStale
            ? 'STALE'
            : runResult
              ? runResult.kind === 'image' ? 'LIVE IMAGE' : 'LIVE TEXT'
              : saveStatus === 'saved'
                ? selected?.recordType === 'candidate' ? 'DRAFT SAVED' : 'EFFECT SAVED'
                : selected && !isRunnablePromptOutput(selected.outputKind)
                  ? selected.effectImageUrl ? 'MANAGED PREVIEW' : 'MANAGED ONLY'
                  : selected?.effectImageUrl
                    ? 'STORED EFFECT'
                    : selected?.outputKind === 'image' ? 'IMAGE READY' : 'PROMPT TEXT'

  function renderStageContent() {
    if (captureMode) {
      if (pendingImageUrl) {
        return (
          <figure className="prompt-workbench__stored-effect prompt-workbench__pending-effect">
            <Image
              src={pendingImageUrl}
              alt="新 Prompt 草稿的本地截图预览"
              width={1600}
              height={1200}
              unoptimized
              sizes="(max-width: 992px) 100vw, 64vw"
            />
            <figcaption>LOCAL CAPTURE · UNSAVED · PRIVATE DRAFT ON SAVE</figcaption>
          </figure>
        )
      }
      if (editorValue.trim()) {
        return (
          <div className="prompt-workbench__text-effect">
            <span aria-hidden="true">[ ::: PRIVATE TEXT DRAFT / UNSAVED ::: ]</span>
            <pre>{editorValue}</pre>
          </div>
        )
      }
      return (
        <div className="prompt-workbench__capture-empty">
          <ImagePlus aria-hidden />
          <strong>PASTE A SCREENSHOT</strong>
          <p>Ctrl/Cmd+V, Paste Image, or choose a file. Prompt text is optional for the first save.</p>
          <span>NOT PUBLISHED · NOT VERIFIED</span>
        </div>
      )
    }

    if (!selected) return null
    if (pendingImageUrl) {
      return (
        <figure className="prompt-workbench__stored-effect prompt-workbench__pending-effect">
          <Image
            src={pendingImageUrl}
            alt={`${selected.title} 的待保存效果预览`}
            width={1600}
            height={1200}
            unoptimized
            sizes="(max-width: 992px) 100vw, 64vw"
          />
          <figcaption>LOCAL PREVIEW · UNSAVED · SAVED RECORD UNCHANGED</figcaption>
        </figure>
      )
    }
    if (runStatus === 'running') {
      return (
        <div className="prompt-workbench__running" role="status" aria-live="polite">
          <span aria-hidden="true">[ ::: ··· ::: ]</span>
          <strong>WAITING FOR {OUTPUT_KIND_COPY[selected.outputKind]} MODEL</strong>
          <p>结果返回前不会覆盖已保存内容。</p>
        </div>
      )
    }
    if (runError) {
      return (
        <div className="prompt-workbench__error" role="alert">
          <strong>RUN FAILED</strong>
          <p>{runError}</p>
          {runnerState === 'signin' ? <Link href={signInHref}>登录后重试</Link> : null}
        </div>
      )
    }
    if (runResult) {
      return (
        <div className={`prompt-workbench__result ${runResult.kind === 'image' ? 'prompt-workbench__result--image' : ''}`}>
          {resultIsStale ? (
            <p className="prompt-workbench__stale" role="status">编辑器内容已变化；以下结果对应上一次运行。</p>
          ) : null}
          {runResult.kind === 'image' ? (
            <figure className="prompt-workbench__stored-effect prompt-workbench__generated-effect">
              <Image
                src={runResult.image.dataUrl}
                alt={`${selected.title} 的本次 CPA 生图测试结果`}
                width={runResult.image.width}
                height={runResult.image.height}
                unoptimized
                sizes="(max-width: 992px) 100vw, 64vw"
              />
              <figcaption>
                LIVE TEST IMAGE · NOT SAVED · {runResult.image.width}×{runResult.image.height}
              </figcaption>
            </figure>
          ) : <pre>{runResult.output}</pre>}
          <footer>
            <span>{runResult.attribution.provider} / {runResult.attribution.modelVersion}</span>
            <time dateTime={runResult.attribution.generatedAt}>
              {new Date(runResult.attribution.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </time>
          </footer>
        </div>
      )
    }
    if (selected.effectImageUrl) {
      return (
        <figure className="prompt-workbench__stored-effect">
          <Image
            src={selected.effectImageUrl}
            alt={selected.effectNote || `${selected.title} 的已保存效果`}
            width={1600}
            height={1200}
            priority
            unoptimized
            sizes="(max-width: 992px) 100vw, 64vw"
          />
          <figcaption>
            {!isRunnablePromptOutput(selected.outputKind)
              ? `MANAGED ONLY · ${selected.effectNote || '已保存预览；第一阶段不会运行此输出类型。'}`
              : selected.recordType === 'candidate'
                ? 'PRIVATE CANDIDATE DRAFT · RESULT UNVERIFIED · PUBLISH BLOCKED'
                : hasChanges
                  ? '编辑器已修改；此图仍对应已发布 Prompt，运行后才会更新中央结果。'
                  : selected.effectNote || '这是一条已保存的真实效果记录。'}
          </figcaption>
        </figure>
      )
    }
    if (selected.outputKind === 'image') {
      return (
        <div className="prompt-workbench__text-effect prompt-workbench__image-empty">
          <span aria-hidden="true">[ ::: IMAGE OUTPUT / RUN OR PASTE TO PREVIEW ::: ]</span>
          <strong>CPA IMAGE STAGE</strong>
        </div>
      )
    }
    if (!isRunnablePromptOutput(selected.outputKind)) {
      return (
        <div className="prompt-workbench__text-effect prompt-workbench__managed-only">
          <span aria-hidden="true">[ ::: {OUTPUT_KIND_COPY[selected.outputKind]} / MANAGEMENT ONLY ::: ]</span>
          <strong>{OUTPUT_KIND_COPY[selected.outputKind]} PROMPT</strong>
          <p>第一阶段只保存和整理这类 Prompt，不执行模型验证。</p>
          <pre>{editorValue || 'Prompt text can be added later.'}</pre>
        </div>
      )
    }
    return (
      <div className="prompt-workbench__text-effect">
        <span aria-hidden="true">[ ::: TEXT OUTPUT / NO STORED EFFECT ::: ]</span>
        <pre>{editorValue || 'Prompt text can be added later.'}</pre>
      </div>
    )
  }

  if (!selected && !captureMode) {
    return (
      <section className="prompt-workbench prompt-workbench--empty">
        <h1>WORKBENCH</h1>
        <p>还没有可进入工作台的公开 Prompt。</p>
        {canManage ? (
          <button type="button" className="ascii-button ascii-button--solid" onClick={startCapture}>
            <Plus className="h-4 w-4" aria-hidden /> NEW DRAFT
          </button>
        ) : <Link href="/skills" className="ascii-button">返回 Prompt</Link>}
      </section>
    )
  }

  const currentTitle = captureMode ? draftTitle : selected?.title ?? 'Untitled Capture'
  const outputThumb = pendingImageUrl
    ?? (runResult?.kind === 'image' ? runResult.image.dataUrl : selected?.effectImageUrl)
  const outputLabel = pendingImageFile
    ? 'LOCAL · UNSAVED'
    : runResult
      ? 'LATEST RUN'
      : selected?.effectImageUrl
        ? selected.recordType === 'candidate' ? 'PRIVATE DRAFT' : 'STORED EFFECT'
        : 'NO EFFECT YET'

  async function handleMobilePrimary() {
    if (captureMode) return saveNewDraft()
    if (pendingImageFile) return savePendingEffect()
    if (selected?.recordType === 'candidate' && hasChanges) return saveCandidateDraft()
    return runPrompt()
  }

  const mobilePrimaryDisabled = saveStatus === 'saving'
    || runStatus === 'running'
    || (captureMode
      ? !canSaveNewDraft
      : pendingImageFile
        ? !canManage
        : selected?.recordType === 'candidate' && hasChanges
                  ? !canSaveCandidateDraft
                  : !canRun)
  const mobilePrimaryIsSignIn = needsSignInForRun
    && !pendingImageFile
    && !(selected?.recordType === 'candidate' && hasChanges)
  const mobilePrimaryLabel = saveStatus === 'saving'
    ? 'SAVING'
    : runStatus === 'running'
      ? 'RUNNING'
      : captureMode
        ? 'SAVE DRAFT'
        : pendingImageFile
          ? 'SAVE EFFECT'
          : selected?.recordType === 'candidate' && hasChanges
            ? 'SAVE DRAFT'
            : !selectedIsRunnable
              ? 'MANAGED'
              : runnerState === 'not-configured'
                ? 'NO MODEL'
                : 'RUN TEST'

  return (
    <section
      className="prompt-workbench"
      data-mobile-view={mobileView}
      data-output-kind={activeOutputKind}
      data-capture-mode={captureMode ? 'true' : 'false'}
      aria-label="Prompt 工作台"
      onPaste={handlePaste}
    >
      <h1 className="sr-only">Prompt Workbench</h1>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) acceptEffectFile(file)
          event.target.value = ''
        }}
      />

      <nav className="prompt-workbench__mobile-tabs" aria-label="工作台区域">
        {(['output', 'prompts', 'edit'] as const).map((view) => (
          <button
            key={view}
            type="button"
            className={mobileView === view ? 'is-active' : ''}
            aria-pressed={mobileView === view}
            onClick={() => setMobileView(view)}
          >
            {view.toUpperCase()}
          </button>
        ))}
      </nav>

      <div className="prompt-workbench__grid">
        <aside className="prompt-workbench__index" aria-labelledby="workbench-prompts-title">
          <div className="prompt-workbench__panel-heading prompt-workbench__library-heading">
            <h2 id="workbench-prompts-title">LIBRARY</h2>
            <div>
              {canManage ? (
                <button type="button" onClick={startCapture}>
                  <Plus aria-hidden /> NEW
                </button>
              ) : null}
              <span>{String(library.length).padStart(2, '0')}</span>
            </div>
          </div>
          <label className="prompt-workbench__filter">
            <span className="sr-only">筛选 Prompt</span>
            <Search className="h-4 w-4" aria-hidden />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search prompts"
            />
          </label>
          <div className="prompt-workbench__groups" role="group" aria-label="按输出类型筛选">
            {PROMPT_GROUPS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={group === item.id ? 'is-active' : ''}
                aria-pressed={group === item.id}
                onClick={() => setGroup(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="prompt-workbench__prompt-list">
            {visiblePrompts.map((prompt) => {
              const active = !captureMode && selected
                ? workbenchRecordKey(prompt) === workbenchRecordKey(selected)
                : false
              return (
                <button
                  key={workbenchRecordKey(prompt)}
                  type="button"
                  className={`${active ? 'is-active' : ''} ${prompt.recordType === 'candidate' ? 'is-draft' : ''}`.trim()}
                  aria-pressed={active}
                  onClick={() => selectPrompt(prompt)}
                >
                  <span className="prompt-workbench__prompt-thumb" aria-hidden="true">
                    {prompt.effectImageUrl ? (
                      <Image
                        src={prompt.effectImageUrl}
                        alt=""
                        width={72}
                        height={72}
                        unoptimized
                      />
                    ) : (
                      <span>{OUTPUT_KIND_COPY[prompt.outputKind].slice(0, 3)}</span>
                    )}
                  </span>
                  <span className="prompt-workbench__prompt-copy">
                    <strong>{prompt.title}</strong>
                    <small>
                      {OUTPUT_KIND_COPY[prompt.outputKind]} · {prompt.recordType === 'candidate' ? 'PRIVATE DRAFT' : prompt.categoryLabel}
                    </small>
                  </span>
                  <span className="prompt-workbench__prompt-menu" aria-hidden="true">···</span>
                </button>
              )
            })}
            {visiblePrompts.length === 0 ? <p>没有匹配的 Prompt。</p> : null}
          </div>
        </aside>

        <section className="prompt-workbench__stage" aria-labelledby="workbench-output-title">
          <div className="prompt-workbench__panel-heading prompt-workbench__stage-heading">
            <div>
              <h2 id="workbench-output-title">OUTPUT</h2>
              <span>{currentTitle}</span>
            </div>
            <div className="prompt-workbench__stage-actions">
              {canManage ? (
                <>
                  <button type="button" onClick={() => void readImageFromClipboard()}>
                    <ClipboardPaste aria-hidden /> PASTE
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    <Upload aria-hidden /> UPLOAD
                  </button>
                </>
              ) : null}
              <Link href="/skills">COMPARE</Link>
              <button
                type="button"
                className={referencesOpen ? 'is-active' : ''}
                aria-expanded={referencesOpen}
                aria-controls="workbench-reference-drawer"
                aria-label={referencesOpen ? '关闭创作参考链接' : '打开创作参考链接'}
                title="Creative references"
                onClick={() => setReferencesOpen((current) => !current)}
              >
                {referencesOpen ? <X aria-hidden /> : <Compass aria-hidden />}
                REFERENCES
              </button>
              <span className={stageState === 'ERROR' || stageState === 'STALE' || pendingImageFile ? 'is-warning' : ''}>
                {stageState}
              </span>
            </div>
          </div>
          <section
            id="workbench-reference-drawer"
            className="prompt-workbench__reference-drawer"
            aria-labelledby="workbench-reference-title"
            hidden={!referencesOpen}
          >
            <header>
              <div>
                <h3 id="workbench-reference-title">CREATIVE REFERENCES</h3>
                <p>Curated external indexes for prompt, visual, and interface study.</p>
              </div>
              <button type="button" onClick={() => setReferencesOpen(false)}>
                <X aria-hidden /> CLOSE
              </button>
            </header>
            <div className="prompt-workbench__reference-groups">
              {CREATIVE_REFERENCE_GROUPS.map((group) => (
                <section key={group.title}>
                  <header>
                    <h4>{group.title}</h4>
                    <p>{group.description}</p>
                  </header>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href} target="_blank" rel="noopener noreferrer">
                          <span>
                            <strong>{link.label}</strong>
                            <small>{link.host}</small>
                          </span>
                          <span>{link.note}</span>
                          <ExternalLink aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <footer>EXTERNAL SOURCES · VERIFY LICENSES · OPEN IN NEW TAB · TERMS MAY CHANGE</footer>
          </section>
          <div className="prompt-workbench__stage-body">
            {renderStageContent()}
          </div>
          <footer className="prompt-workbench__output-rail">
            <div className="prompt-workbench__output-thumbs" aria-label="当前输出预览">
              {outputThumb ? (
                <Image src={outputThumb} alt="" width={72} height={72} unoptimized />
              ) : (
                <span aria-hidden="true">[{OUTPUT_KIND_COPY[activeOutputKind]}]</span>
              )}
              <span>{outputLabel}</span>
            </div>
            <div className="prompt-workbench__output-actions">
              {saveMessage ? (
                <span role={saveStatus === 'error' ? 'alert' : 'status'}>{saveMessage}</span>
              ) : null}
              {pendingImageFile ? (
                <button type="button" onClick={clearPendingImage} disabled={saveStatus === 'saving'}>
                  <X aria-hidden /> DISCARD
                </button>
              ) : null}
              {pendingImageFile && !captureMode ? (
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => void savePendingEffect()}
                  disabled={!canManage || saveStatus === 'saving'}
                >
                  <Save aria-hidden /> {saveStatus === 'saving' ? 'SAVING' : 'SAVE EFFECT'}
                </button>
              ) : null}
            </div>
          </footer>
        </section>

        <aside className="prompt-workbench__editor" aria-labelledby="workbench-editor-title">
          {captureMode ? (
            <>
              <div className="prompt-workbench__panel-heading">
                <h2 id="workbench-editor-title">NEW DRAFT</h2>
                <span>PRIVATE</span>
              </div>
              <div className="prompt-workbench__capture-form">
                <label>
                  <span>TITLE</span>
                  <input
                    value={draftTitle}
                    maxLength={120}
                    onChange={(event) => setDraftTitle(event.target.value)}
                  />
                </label>
                <label>
                  <span>OUTPUT</span>
                  <select
                    value={draftOutputKind}
                    onChange={(event) => setDraftOutputKind(event.target.value as PromptOutputKind)}
                  >
                    {Object.entries(OUTPUT_KIND_COPY).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="prompt-workbench__capture-prompt">
                  <span>PROMPT · OPTIONAL</span>
                  <textarea
                    value={editorValue}
                    maxLength={12_000}
                    spellCheck={false}
                    placeholder="Add the prompt now, or leave it empty and save the screenshot first."
                    onChange={(event) => setEditorValue(event.target.value)}
                  />
                </label>
                <label>
                  <span>SOURCE NOTE · OPTIONAL</span>
                  <textarea
                    value={draftNote}
                    maxLength={1000}
                    placeholder="Where you found it, what looked interesting, what still needs verification."
                    onChange={(event) => setDraftNote(event.target.value)}
                  />
                </label>
              </div>
              <dl className="prompt-workbench__draft-truth">
                <div><dt>PROMPT</dt><dd>{editorValue.trim() ? 'CAPTURED' : 'EMPTY'}</dd></div>
                <div><dt>RESULT</dt><dd>UNVERIFIED</dd></div>
                <div><dt>PUBLISH</dt><dd>BLOCKED</dd></div>
              </dl>
              <p className="prompt-workbench__safety is-warning">
                PRIVATE CANDIDATE · HUMAN VERIFICATION REQUIRED
              </p>
              <div className="prompt-workbench__editor-actions">
                <button
                  type="button"
                  className="ascii-button ascii-button--solid"
                  disabled={!canSaveNewDraft || saveStatus === 'saving'}
                  onClick={() => void saveNewDraft()}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {saveStatus === 'saving' ? 'SAVING' : 'SAVE DRAFT'}
                </button>
                <button type="button" className="ascii-button" onClick={cancelCapture}>
                  <X className="h-4 w-4" aria-hidden /> CANCEL
                </button>
              </div>
            </>
          ) : selected ? (
            <>
              <div className="prompt-workbench__panel-heading">
                <h2 id="workbench-editor-title">{selected.recordType === 'candidate' ? 'DRAFT' : 'RECIPE'}</h2>
                <span>{editorValue.length}/12000</span>
              </div>
              <label className="prompt-workbench__editor-field">
                <span>PROMPT{selected.recordType === 'candidate' ? ' · OPTIONAL UNTIL VERIFIED' : ''}</span>
                <textarea
                  value={editorValue}
                  maxLength={12_000}
                  spellCheck={false}
                  onChange={(event) => setEditorValue(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault()
                      void runPrompt()
                    }
                  }}
                />
              </label>
              <label className="prompt-workbench__model-field">
                <span>MODEL</span>
                <select value={modelId} disabled={compatibleModels.length === 0} onChange={(event) => setModelId(event.target.value)}>
                  {compatibleModels.length > 0
                    ? compatibleModels.map((model) => (
                      <option key={model.id} value={model.id} disabled={!model.configured}>
                        {model.label}{model.configured ? '' : ' · NOT CONFIGURED'}
                      </option>
                    ))
                    : <option value="">No phase-one runner</option>}
                </select>
              </label>
              <dl className="prompt-workbench__run-meta">
                <div><dt>OUTPUT</dt><dd>{OUTPUT_KIND_COPY[selected.outputKind]}</dd></div>
                <div><dt>RECORD</dt><dd>{selected.recordType === 'candidate' ? 'PRIVATE' : 'PUBLISHED'}</dd></div>
                <div><dt>RUN SAVE</dt><dd>NO</dd></div>
              </dl>
              <p className={`prompt-workbench__safety ${runnerState === 'ready' && selectedModel?.configured ? '' : 'is-warning'}`}>
                {!selectedIsRunnable
                  ? 'MANAGED ONLY · NO EXECUTION IN PHASE 1'
                  : runnerState === 'ready' && selectedModel?.configured
                    ? selected.recordType === 'candidate'
                      ? 'DRAFT EDITS SAVE EXPLICITLY · RUN RESULT DOES NOT'
                      : 'TEST ONLY · NOT SAVED'
                    : runnerState === 'signin'
                      ? 'ADMIN ACCESS REQUIRED · SIGN IN TO RUN'
                      : `${OUTPUT_KIND_COPY[selected.outputKind]} MODEL NOT CONFIGURED`}
              </p>
              <div className="prompt-workbench__editor-actions">
                {selected.recordType === 'candidate' ? (
                  <button
                    type="button"
                    className="ascii-button ascii-button--solid"
                    disabled={!canSaveCandidateDraft || saveStatus === 'saving'}
                    onClick={() => void saveCandidateDraft()}
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {saveStatus === 'saving' ? 'SAVING' : 'SAVE DRAFT'}
                  </button>
                ) : needsSignInForRun ? (
                  <Link
                    className="ascii-button ascii-button--solid prompt-workbench__signin-action"
                    href={signInHref}
                  >
                    <LogIn className="h-4 w-4" aria-hidden />
                    SIGN IN TO RUN
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="ascii-button ascii-button--solid"
                    disabled={!canRun || runStatus === 'running'}
                    onClick={() => void runPrompt()}
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    {runStatus === 'running' ? 'RUNNING' : selectedIsRunnable ? '[ RUN ]' : 'NO RUNNER'}
                  </button>
                )}
                {selected.recordType === 'candidate' ? (
                  <button
                    type="button"
                    className="ascii-button"
                    disabled={!canRun || runStatus === 'running'}
                    onClick={() => void runPrompt()}
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    {runStatus === 'running' ? 'RUNNING' : selectedIsRunnable ? 'RUN TEST' : 'MANAGED'}
                  </button>
                ) : (
                  <button type="button" className="ascii-button" disabled={!hasChanges && !runResult} onClick={resetEditor}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> RESET
                  </button>
                )}
              </div>
              <Link
                className="prompt-workbench__record-link"
                href={selected.recordType === 'candidate' ? `/candidates/${selected.slug}` : `/skills/${selected.slug}`}
              >
                OPEN {selected.recordType === 'candidate' ? 'PRIVATE DRAFT' : 'PUBLISHED RECORD'}
              </Link>
              {saveMessage ? (
                <p className={`prompt-workbench__save-message ${saveStatus === 'error' ? 'is-error' : ''}`} role={saveStatus === 'error' ? 'alert' : 'status'}>
                  {saveMessage}
                </p>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>

      <footer className="prompt-workbench__status" aria-live="polite">
        <span>STATUS <strong>{stageState}</strong></span>
        <span>PROMPT <strong>{currentTitle}</strong></span>
        <span>OUTPUT <strong>{OUTPUT_KIND_COPY[activeOutputKind]}</strong></span>
        {mobilePrimaryIsSignIn ? (
          <Link className="prompt-workbench__mobile-run" href={signInHref}>
            <LogIn className="h-4 w-4" aria-hidden /> SIGN IN
          </Link>
        ) : (
          <button
            type="button"
            className="prompt-workbench__mobile-run"
            disabled={mobilePrimaryDisabled}
            onClick={() => void handleMobilePrimary()}
          >
            {captureMode || pendingImageFile || (selected?.recordType === 'candidate' && hasChanges)
              ? <Save className="h-4 w-4" aria-hidden />
              : <Play className="h-4 w-4" aria-hidden />}
            {mobilePrimaryLabel}
          </button>
        )}
      </footer>
    </section>
  )
}
