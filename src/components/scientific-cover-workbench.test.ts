import { describe, expect, it } from 'vitest'
import { nextShortlist, parseBriefList, parseDirectionList } from './scientific-cover-workbench'

describe('scientific cover workbench helpers', () => {
  it('normalizes line-based truth constraints without inventing content', () => {
    expect(parseBriefList(' first fact \n\nsecond fact\r\n ')).toEqual(['first fact', 'second fact'])
  })

  it('accepts comma or line-separated art direction terms', () => {
    expect(parseDirectionList('precise, restrained\neditorial，quiet')).toEqual([
      'precise',
      'restrained',
      'editorial',
      'quiet',
    ])
  })

  it('limits the provisional human shortlist to two and supports deselection', () => {
    expect(nextShortlist([], 'initial-01')).toEqual(['initial-01'])
    expect(nextShortlist(['initial-01'], 'initial-02')).toEqual(['initial-01', 'initial-02'])
    const full = ['initial-01', 'initial-02']
    expect(nextShortlist(full, 'initial-03')).toBe(full)
    expect(nextShortlist(full, 'initial-01')).toEqual(['initial-02'])
  })
})
