'use client'

import { ChangeEvent, FormEvent, useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {
  Camera,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  Send,
  Sparkles,
  Type,
  Upload,
  X,
} from 'lucide-react'

interface QuickIdeaDialogProps {
  isAuthenticated: boolean
}

interface IdeaResponse {
  error?: string
  candidate?: {
    slug?: string
  }
}

type CreateMode = 'text' | 'image'

const ERROR_MESSAGES: Record<string, string> = {
  ERR_IDEA_INPUT: '请输入至少两个字，最多 2000 字。',
  ERR_RATE_LIMIT_EXCEEDED: '今天的快速创建次数已用完，请明天再试。',
  ERR_IDEA_AI_NOT_CONFIGURED: 'AI 服务尚未配置，请联系管理员。',
  ERR_IDEA_AI_AUTH: 'AI 服务凭据无效或区域不匹配，请联系管理员。',
  ERR_IDEA_AI_UNAVAILABLE: 'AI 服务暂时不可用，请稍后重试。',
  ERR_IDEA_AI_INVALID_RESPONSE: 'AI 没有生成可用结果，请补充信息后重试。',
  ERR_IDEA_CONTENT_REJECTED: '提炼结果包含不适合公开展示的内容，请调整输入后重试。',
  ERR_IDEA_CREATE_FAILED: '创建失败，请稍后重试。',
  ERR_IMAGE_REQUIRED: '请选择一张图片。',
  ERR_IMAGE_TYPE: '仅支持 JPG、PNG 或 WebP 图片。',
  ERR_IMAGE_SIZE: '图片不能超过 10MB。',
  ERR_IMAGE_SIGNATURE: '图片内容与文件类型不一致，请重新选择。',
  ERR_IMAGE_INVALID: '图片无法安全处理，请重新选择。',
  ERR_IMAGE_CONTENT_REJECTED: '标题、备注或 Tags 包含不适合公开展示的内容。',
  ERR_IMAGE_FIELDS: '请检查标题和 Tags 是否符合要求。',
  ERR_IMAGE_CREATE_FAILED: '图片保存失败，请稍后重试。',
}

export function QuickIdeaDialog({ isAuthenticated }: QuickIdeaDialogProps) {
  const router = useRouter()
  const titleId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<CreateMode>('text')
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageTitle, setImageTitle] = useState('')
  const [imageTags, setImageTags] = useState('')
  const [imageNote, setImageNote] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (mode === 'text') inputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, mode])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const openDialog = () => {
    if (!isAuthenticated) {
      void signIn(undefined, { callbackUrl: '/candidates' })
      return
    }
    setError('')
    setIsOpen(true)
  }

  const closeDialog = () => {
    if (!isSubmitting) setIsOpen(false)
  }

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setError('')
    setImageFile(file)
    event.target.value = ''
  }

  const submitIdea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedInput = input.trim()
    if (trimmedInput.length < 2 || isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/candidates/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmedInput }),
      })
      const payload = await response.json().catch(() => ({})) as IdeaResponse

      if (!response.ok) {
        if (response.status === 401) {
          await signIn(undefined, { callbackUrl: '/candidates' })
          return
        }
        setError(ERROR_MESSAGES[payload.error || ''] || '创建失败，请稍后重试。')
        return
      }

      if (!payload.candidate?.slug) {
        setError('创建结果不完整，请稍后重试。')
        return
      }

      setIsOpen(false)
      setInput('')
      router.push(`/candidates/${encodeURIComponent(payload.candidate.slug)}`)
      router.refresh()
    } catch {
      setError('网络连接失败，请检查连接后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = imageTitle.trim()
    if (!imageFile || title.length < 2 || isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      const form = new FormData()
      form.set('file', imageFile)
      form.set('title', title)
      form.set('tags', imageTags)
      form.set('note', imageNote.trim())

      const response = await fetch('/api/candidates/image', {
        method: 'POST',
        body: form,
      })
      const payload = await response.json().catch(() => ({})) as IdeaResponse

      if (!response.ok) {
        if (response.status === 401) {
          await signIn(undefined, { callbackUrl: '/candidates' })
          return
        }
        setError(ERROR_MESSAGES[payload.error || ''] || '图片保存失败，请稍后重试。')
        return
      }
      if (!payload.candidate?.slug) {
        setError('创建结果不完整，请稍后重试。')
        return
      }

      setIsOpen(false)
      setImageFile(null)
      setImageTitle('')
      setImageTags('')
      setImageNote('')
      router.push(`/candidates/${encodeURIComponent(payload.candidate.slug)}`)
      router.refresh()
    } catch {
      setError('网络连接失败，请检查连接后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="cyber-button inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-amber-400/25 bg-[var(--color-surface-1)] p-5 shadow-2xl shadow-black/50 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-amber-300">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-[0.2em]">Quick Idea</span>
                </div>
                <h2 id={titleId} className="text-xl font-semibold text-[var(--color-text-strong)]">
                  快速记下灵感
                </h2>
                <p id={descriptionId} className="mt-1 text-sm leading-6 text-muted">
                  输入一句话、关键词、GitHub 仓库、文档链接或一个名字。
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isSubmitting}
                aria-label="关闭"
                title="关闭"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-divider text-muted transition-colors hover:border-amber-400/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div
              className="mt-5 grid grid-cols-2 rounded-lg border border-divider bg-black/20 p-1"
              role="tablist"
              aria-label="灵感类型"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'text'}
                onClick={() => {
                  setMode('text')
                  setError('')
                }}
                disabled={isSubmitting}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors ${
                  mode === 'text'
                    ? 'bg-amber-400/15 text-amber-200'
                    : 'text-muted hover:text-[var(--color-text-strong)]'
                }`}
              >
                <Type className="h-4 w-4" aria-hidden="true" />
                文本
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'image'}
                onClick={() => {
                  setMode('image')
                  setError('')
                }}
                disabled={isSubmitting}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors ${
                  mode === 'image'
                    ? 'bg-amber-400/15 text-amber-200'
                    : 'text-muted hover:text-[var(--color-text-strong)]'
                }`}
              >
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                图片
              </button>
            </div>

            {mode === 'text' ? (
              <form className="mt-4" onSubmit={submitIdea}>
                <label htmlFor="quick-idea-input" className="sr-only">灵感内容</label>
                <textarea
                  ref={inputRef}
                  id="quick-idea-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={2000}
                  rows={7}
                  disabled={isSubmitting}
                  placeholder="例如：github.com/owner/repo，想看看它能不能解决……"
                  className="min-h-40 w-full resize-y rounded-lg border border-divider bg-black/20 px-4 py-3 text-base leading-7 text-[var(--color-text-strong)] outline-none transition-colors placeholder:text-soft focus:border-amber-400/60 disabled:cursor-wait disabled:opacity-70"
                />

                <div className="mt-2 flex items-center justify-between gap-4 text-xs text-soft">
                  <span>提交内容会发送给 DeepSeek 提炼，不会让 AI 虚构链接信息。</span>
                  <span className="shrink-0 tabular-nums">{input.length}/2000</span>
                </div>

                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isSubmitting}
                    className="h-10 rounded-lg border border-divider px-4 text-sm text-muted transition-colors hover:text-[var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={input.trim().length < 2 || isSubmitting}
                    className="cyber-button inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : <Send className="h-4 w-4" aria-hidden="true" />}
                    {isSubmitting ? '提炼中' : '创建'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="mt-4" onSubmit={submitImage}>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={selectImage}
                  className="sr-only"
                  tabIndex={-1}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={selectImage}
                  className="sr-only"
                  tabIndex={-1}
                />

                {imagePreview ? (
                  <div className="relative flex max-h-64 min-h-44 items-center justify-center overflow-hidden rounded-lg border border-divider bg-black/30">
                    <Image
                      src={imagePreview}
                      alt="待上传图片预览"
                      width={960}
                      height={720}
                      unoptimized
                      className="max-h-64 w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setImageFile(null)}
                      disabled={isSubmitting}
                      aria-label="移除图片"
                      title="移除图片"
                      className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-black/75 text-white hover:bg-black"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-divider bg-black/15 px-3 text-sm text-muted hover:border-amber-400/40 hover:text-amber-200"
                    >
                      <Upload className="h-5 w-5" aria-hidden="true" />
                      相册或截图
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-divider bg-black/15 px-3 text-sm text-muted hover:border-amber-400/40 hover:text-amber-200"
                    >
                      <Camera className="h-5 w-5" aria-hidden="true" />
                      拍照
                    </button>
                  </div>
                )}

                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1.5 text-sm text-muted">
                    标题
                    <input
                      value={imageTitle}
                      onChange={(event) => setImageTitle(event.target.value)}
                      minLength={2}
                      maxLength={120}
                      required
                      disabled={isSubmitting}
                      placeholder="这张图值得记住的原因"
                      className="h-11 rounded-lg border border-divider bg-black/20 px-3 text-base text-[var(--color-text-strong)] outline-none placeholder:text-soft focus:border-amber-400/60"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm text-muted">
                    Tags
                    <input
                      value={imageTags}
                      onChange={(event) => setImageTags(event.target.value)}
                      maxLength={240}
                      disabled={isSubmitting}
                      placeholder="例如：移动端, 排版, 深色界面"
                      className="h-11 rounded-lg border border-divider bg-black/20 px-3 text-base text-[var(--color-text-strong)] outline-none placeholder:text-soft focus:border-amber-400/60"
                    />
                    <span className="text-xs text-soft">用逗号分隔，最多 8 个。</span>
                  </label>
                  <label className="grid gap-1.5 text-sm text-muted">
                    备注 <span className="sr-only">（选填）</span>
                    <textarea
                      value={imageNote}
                      onChange={(event) => setImageNote(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      disabled={isSubmitting}
                      placeholder="选填：喜欢哪里、之后想研究什么"
                      className="min-h-24 resize-y rounded-lg border border-divider bg-black/20 px-3 py-2 text-base leading-6 text-[var(--color-text-strong)] outline-none placeholder:text-soft focus:border-amber-400/60"
                    />
                  </label>
                </div>

                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isSubmitting}
                    className="h-10 rounded-lg border border-divider px-4 text-sm text-muted transition-colors hover:text-[var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!imageFile || imageTitle.trim().length < 2 || isSubmitting}
                    className="cyber-button inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : <Upload className="h-4 w-4" aria-hidden="true" />}
                    {isSubmitting ? '保存中' : '保存图片'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
