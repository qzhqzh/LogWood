import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AgentSkillHub } from './hub-client'

describe('Skill Hub page', () => {
  it('offers browsing and login without exposing publisher or reviewer controls anonymously', () => {
    const html = renderToStaticMarkup(createElement(AgentSkillHub, {
      published: [], mine: [], queue: [], tokens: [], signedIn: false, admin: false,
    }))
    expect(html).toContain('Skill Hub')
    expect(html).toContain('尚无审核通过的 Skill 包')
    expect(html).toContain('/auth/signin?callbackUrl=%2Fawesome%2Fskills%2Fhub')
    expect(html).not.toContain('批准发布')
    expect(html).not.toContain('生成发布凭证')
  })
})
