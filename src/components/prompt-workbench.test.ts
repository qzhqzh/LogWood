import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  clipboardImageFile,
  filterWorkbenchPrompts,
  initialWorkbenchPrompt,
  preferredModelId,
  PromptWorkbench,
  readPromptRunResponse,
} from './prompt-workbench'

describe('PromptWorkbench', () => {
  it('renders the real prompt, model control, non-persistence notice and three work regions', () => {
    const html = renderToStaticMarkup(createElement(PromptWorkbench, {
      prompts: [{
        id: 'skill-1',
        slug: 'real-prompt',
        title: '真实 Prompt',
        categoryLabel: '工作流',
        summary: '真实说明',
        prompt: '只使用已保存的提示词正文',
        effectImageUrl: null,
        effectNote: null,
        outputKind: 'text',
        updatedAt: '2026-08-23T00:00:00.000Z',
      }],
      models: [{
        id: 'deepseek-test',
        label: 'DeepSeek · TEXT / deepseek-test',
        provider: 'DeepSeek',
        outputType: 'text',
        configured: true,
      }],
      runnerState: 'ready',
      signInHref: '/auth/signin',
    }))

    expect(html).toContain('LIBRARY')
    expect(html).toContain('OUTPUT')
    expect(html).toContain('RECIPE')
    expect(html).toContain('只使用已保存的提示词正文')
    expect(html).toContain('DeepSeek · TEXT / deepseek-test')
    expect(html).toContain('TEST ONLY · NOT SAVED')
    expect(html).toContain('PROMPT RESOURCES')
    expect(html).toContain('AESTHETIC REFERENCES')
    expect(html).toContain('UI / ICON LIBRARIES')
    expect(html).toContain('Morphicons')
    expect(html).toContain('Liquid Gooey')
    expect(html).toContain('CREATIVE TOOLS')
    expect(html).toContain('Image Master')
    expect(html).toContain('GAME ART ASSETS')
    expect(html).toContain('VERIFY LICENSES')
    expect(html).toContain('href="https://prompthero.com/"')
    expect(html).toContain('href="https://www.recraft.ai/community"')
    expect(html).toContain('href="https://www.jamecling.com/archives/5546"')
    expect(html).toContain('href="https://gooey.jakubantalik.com/"')
    expect(html).toContain('href="https://image.moonrailgun.com/"')
    expect(html).toContain('href="https://kenney.nl/assets/"')
    expect(html).toContain('href="https://itch.io/game-assets"')
    expect(html).toContain('href="https://opengameart.org/"')
    expect(html).toContain('href="https://craftpix.net/"')
    expect(html).toContain('href="https://quaternius.com/"')
    expect(html).toContain('href="https://polyhaven.com/"')
    expect(html).toContain('href="https://game-icons.net/"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('replaces the disabled run action with a visible sign-in link for anonymous users', () => {
    const html = renderToStaticMarkup(createElement(PromptWorkbench, {
      prompts: [{
        id: 'skill-1',
        slug: 'real-prompt',
        title: '真实 Prompt',
        categoryLabel: '工作流',
        summary: null,
        prompt: '运行这条提示词',
        effectImageUrl: null,
        effectNote: null,
        outputKind: 'text',
        updatedAt: '2026-08-23T00:00:00.000Z',
      }],
      models: [{
        id: 'deepseek-test',
        label: 'DeepSeek · TEXT / deepseek-test',
        provider: 'DeepSeek',
        outputType: 'text',
        configured: true,
      }],
      runnerState: 'signin',
      signInHref: '/auth/signin?callbackUrl=%2Fworkbench',
    }))

    expect(html).toContain('ADMIN ACCESS REQUIRED · SIGN IN TO RUN')
    expect(html).toContain('SIGN IN TO RUN')
    expect(html).toContain('href="/auth/signin?callbackUrl=%2Fworkbench"')
    expect(html).not.toContain('登录管理员账号')
  })

  it('routes image prompts to the first configured CPA image model', () => {
    const models = [
      {
        id: 'deepseek-test',
        label: 'DeepSeek · TEXT / deepseek-test',
        provider: 'DeepSeek',
        outputType: 'text' as const,
        configured: true,
      },
      {
        id: 'cpa:image-unavailable',
        label: 'CPA · IMAGE / image-unavailable',
        provider: 'CPA',
        outputType: 'image' as const,
        configured: false,
      },
      {
        id: 'cpa:gemini-image',
        label: 'CPA · IMAGE / gemini-image',
        provider: 'CPA',
        outputType: 'image' as const,
        configured: true,
      },
    ]

    expect(preferredModelId({ outputKind: 'image' }, models)).toBe('cpa:gemini-image')
  })

  it('prefers a real image effect when no prompt is explicitly selected', () => {
    const prompts = [
      {
        id: 'text-1',
        slug: 'text-first',
        title: 'Text first',
        categoryLabel: '文案提示',
        summary: null,
        prompt: 'Write a short answer.',
        effectImageUrl: null,
        effectNote: null,
        outputKind: 'text' as const,
        updatedAt: '2026-08-23T00:00:00.000Z',
      },
      {
        id: 'image-1',
        slug: 'image-with-proof',
        title: 'Image with proof',
        categoryLabel: '图像生成',
        summary: null,
        prompt: 'Render a translucent flower.',
        effectImageUrl: '/effects/flower.webp',
        effectNote: 'Stored result',
        outputKind: 'image' as const,
        updatedAt: '2026-08-23T00:00:00.000Z',
      },
    ]

    expect(initialWorkbenchPrompt(prompts)?.slug).toBe('image-with-proof')
    expect(initialWorkbenchPrompt(prompts, 'text-first')?.slug).toBe('text-first')
  })

  it('keeps document prompts manageable without exposing a phase-one runner', () => {
    const html = renderToStaticMarkup(createElement(PromptWorkbench, {
      prompts: [{
        id: 'document-1',
        slug: 'document-prompt',
        title: '文档整理 Prompt',
        categoryLabel: '工作流',
        summary: '仅管理',
        prompt: '整理一份交付文档，但第一阶段不执行。',
        effectImageUrl: null,
        effectNote: null,
        outputKind: 'document',
        updatedAt: '2026-08-23T00:00:00.000Z',
      }],
      models: [],
      runnerState: 'ready',
      signInHref: '/auth/signin',
    }))

    expect(html).toContain('MANAGED ONLY')
    expect(html).toContain('No phase-one runner')
    expect(html).toContain('NO RUNNER')
    expect(html).toContain('第一阶段只保存和整理这类 Prompt')
  })

  it('labels a managed record with a stored image as a preview, not a runnable effect', () => {
    const html = renderToStaticMarkup(createElement(PromptWorkbench, {
      prompts: [{
        id: 'video-1',
        slug: 'video-prompt',
        title: '视频风格参考',
        categoryLabel: '视觉风格',
        summary: null,
        prompt: '保存镜头语言，第一阶段不运行视频模型。',
        effectImageUrl: '/effects/video-reference.webp',
        effectNote: '静态分镜参考',
        outputKind: 'video',
        updatedAt: '2026-08-23T00:00:00.000Z',
      }],
      models: [],
      runnerState: 'ready',
      signInHref: '/auth/signin',
    }))

    expect(html).toContain('MANAGED PREVIEW')
    expect(html).toContain('MANAGED ONLY · 静态分镜参考')
    expect(html).toContain('NO RUNNER')
  })

  it('filters the compact library by real output groups before applying search', () => {
    const prompts = [
      {
        id: 'image-1', slug: 'image', title: 'Glass flower', categoryLabel: '图像生成',
        summary: null, prompt: 'image prompt', effectImageUrl: null, effectNote: null,
        outputKind: 'image' as const, updatedAt: '2026-08-23T00:00:00.000Z',
      },
      {
        id: 'text-1', slug: 'text', title: 'Release note', categoryLabel: '文案提示',
        summary: null, prompt: 'text prompt', effectImageUrl: null, effectNote: null,
        outputKind: 'text' as const, updatedAt: '2026-08-23T00:00:00.000Z',
      },
      {
        id: 'video-1', slug: 'video', title: 'Camera move', categoryLabel: '工作流',
        summary: null, prompt: 'video prompt', effectImageUrl: null, effectNote: null,
        outputKind: 'video' as const, updatedAt: '2026-08-23T00:00:00.000Z',
      },
    ]

    expect(filterWorkbenchPrompts(prompts, '', 'image').map((item) => item.slug)).toEqual(['image'])
    expect(filterWorkbenchPrompts(prompts, '', 'managed').map((item) => item.slug)).toEqual(['video'])
    expect(filterWorkbenchPrompts(prompts, 'release', 'all').map((item) => item.slug)).toEqual(['text'])
  })

  it('recognizes a pasted image without intercepting clipboard text', () => {
    const file = new File(['image'], 'capture.png', { type: 'image/png' })
    const items = [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => file },
    ] as unknown as ArrayLike<DataTransferItem>

    expect(clipboardImageFile(items)).toBe(file)
    expect(clipboardImageFile([
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
    ] as unknown as ArrayLike<DataTransferItem>)).toBeNull()
  })

  it('renders a screenshot-first candidate as a private draft with an optional prompt', () => {
    const html = renderToStaticMarkup(createElement(PromptWorkbench, {
      prompts: [{
        id: 'candidate-1',
        slug: 'untitled-capture',
        title: 'Untitled Capture',
        categoryLabel: 'DRAFT',
        summary: 'Seen in a client chat',
        prompt: '',
        effectImageUrl: '/uploads/candidates/capture.webp',
        effectNote: 'Seen in a client chat',
        outputKind: 'image',
        updatedAt: '2026-08-23T00:00:00.000Z',
        recordType: 'candidate',
        recordStatus: 'draft',
      }],
      models: [],
      initialDraftSlug: 'untitled-capture',
      runnerState: 'not-configured',
      signInHref: '/auth/signin',
      canManage: true,
    }))

    expect(html).toContain('PRIVATE DRAFT')
    expect(html).toContain('PROMPT · OPTIONAL UNTIL VERIFIED')
    expect(html).toContain('SAVE DRAFT')
    expect(html).toContain('PUBLISH BLOCKED')
  })

  it('reads a prompt result after SSE status and heartbeat frames', async () => {
    const encoder = new TextEncoder()
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: status\ndata: {"status":"running"}\n\n'))
        controller.enqueue(encoder.encode(': keep-alive\n\n'))
        controller.enqueue(encoder.encode(
          'event: result\ndata: {"kind":"text","output":"SSE output","persisted":false,"attribution":{"provider":"DeepSeek","model":"deepseek-test","modelVersion":"2026-08","generatedAt":"2026-08-23T12:00:00.000Z"}}\n\n',
        ))
        controller.close()
      },
    }), {
      headers: { 'Content-Type': 'text/event-stream' },
    })

    await expect(readPromptRunResponse(response)).resolves.toMatchObject({
      kind: 'text',
      output: 'SSE output',
    })
  })
})
