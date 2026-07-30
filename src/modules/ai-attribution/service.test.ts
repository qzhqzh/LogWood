import { describe, expect, it } from 'vitest'
import { normalizeAiAttribution } from './service'

describe('ai-attribution/service', () => {
  const now = new Date('2026-07-29T12:00:00.000Z')

  it('returns nullable fields for human-authored content', () => {
    expect(normalizeAiAttribution(undefined, now)).toEqual({
      aiProvider: null,
      aiModel: null,
      aiModelVersion: null,
      aiGeneratedAt: null,
    })
  })

  it('normalizes a complete AI attribution', () => {
    expect(normalizeAiAttribution({
      provider: ' OpenAI ',
      model: ' gpt-5.4 ',
      modelVersion: ' 2026-06-01 ',
      generatedAt: new Date('2026-07-29T11:58:00.000Z'),
    }, now)).toEqual({
      aiProvider: 'OpenAI',
      aiModel: 'gpt-5.4',
      aiModelVersion: '2026-06-01',
      aiGeneratedAt: new Date('2026-07-29T11:58:00.000Z'),
    })
  })

  it('uses server time when generatedAt is omitted', () => {
    expect(normalizeAiAttribution({
      provider: 'OpenAI',
      model: 'gpt-5.4',
      modelVersion: '2026-06-01',
    }, now).aiGeneratedAt).toEqual(now)
  })

  it('rejects incomplete or future attribution data', () => {
    expect(() => normalizeAiAttribution({
      provider: '',
      model: 'gpt-5.4',
      modelVersion: '2026-06-01',
    }, now)).toThrow('ERR_AI_ATTRIBUTION_INVALID')

    expect(() => normalizeAiAttribution({
      provider: 'OpenAI',
      model: 'gpt-5.4',
      modelVersion: '2026-06-01',
      generatedAt: new Date('2026-07-29T12:06:00.000Z'),
    }, now)).toThrow('ERR_AI_ATTRIBUTION_INVALID')
  })
})
