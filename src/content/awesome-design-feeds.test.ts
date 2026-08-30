import { describe, expect, it } from 'vitest'
import {
  AWESOME_DESIGN_FEEDS,
  AWESOME_INTERFACE_FEEDS,
  AWESOME_MOTION_FEEDS,
} from './awesome-design-feeds'

describe('AWESOME design source register', () => {
  it('keeps the curated interface and motion sources distinct and linkable', () => {
    expect(AWESOME_INTERFACE_FEEDS).toHaveLength(5)
    expect(AWESOME_MOTION_FEEDS).toHaveLength(5)
    expect(AWESOME_DESIGN_FEEDS).toHaveLength(10)
    expect(new Set(AWESOME_DESIGN_FEEDS.map((feed) => feed.url)).size).toBe(10)

    for (const feed of AWESOME_DESIGN_FEEDS) {
      expect(feed.name.length).toBeGreaterThan(2)
      expect(feed.scope).toMatch(/·/)
      expect(feed.url).toMatch(/^https:\/\//)
    }
  })

  it('marks sources that need paid access or a license check before reuse', () => {
    expect(AWESOME_DESIGN_FEEDS.some((feed) => feed.scope.includes('PRO'))).toBe(true)
    expect(AWESOME_DESIGN_FEEDS.some((feed) => feed.scope.includes('LICENSE CHECK'))).toBe(true)
  })
})
