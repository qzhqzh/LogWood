import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PromptEffectStage } from './prompt-effect-stage'

describe('PromptEffectStage', () => {
  it('centers the stored effect image instead of inventing a preview', () => {
    const html = renderToStaticMarkup(createElement(PromptEffectStage, {
      title: '工作流提示词',
      prompt: '执行正文',
      effectImageUrl: '/uploads/skill-effects/seed-workflow.png',
      effectNote: '真实工作流效果',
    }))

    expect(html).toContain('/uploads/skill-effects/seed-workflow.png')
    expect(html).toContain('真实工作流效果')
    expect(html).toContain('prompt-effect-stage__viewport')
    expect(html).not.toContain('尚未记录效果图')
  })

  it('falls back to the executable prompt when no effect image is stored', () => {
    const html = renderToStaticMarkup(createElement(PromptEffectStage, {
      title: '文本提示词',
      prompt: '只使用已保存的正文',
    }))

    expect(html).toContain('尚未记录效果图')
    expect(html).toContain('只使用已保存的正文')
    expect(html).not.toContain('<img')
  })
})
