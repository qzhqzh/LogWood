import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const listAwesomeSkillsMock = vi.hoisted(() => vi.fn())
const resolveActorMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/candidate', () => ({ listAwesomeSkills: listAwesomeSkillsMock }))
vi.mock('@/modules/identity', () => ({ resolveActorWithFingerprint: resolveActorMock }))

import { GET } from './route'

describe('GET /api/awesome/skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveActorMock.mockResolvedValue({
      actorType: 'anonymous',
      actorKey: 'anonymous:anon-1',
      anonymousUserId: 'anon-1',
    })
  })

  it('returns Skill catalog entries with the current actor score', async () => {
    listAwesomeSkillsMock.mockResolvedValue([{ id: 'skill-1', slug: 'prompt-optimizer' }])
    const request = new NextRequest('http://localhost/api/awesome/skills?fingerprint=device-1')

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      skills: [{ id: 'skill-1', slug: 'prompt-optimizer' }],
    })
    expect(resolveActorMock).toHaveBeenCalledWith('device-1')
    expect(listAwesomeSkillsMock).toHaveBeenCalledWith(expect.objectContaining({
      anonymousUserId: 'anon-1',
    }))
  })
})
