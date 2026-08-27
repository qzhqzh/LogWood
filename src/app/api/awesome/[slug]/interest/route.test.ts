import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const setAwesomeInterestMock = vi.hoisted(() => vi.fn())
const resolveActorMock = vi.hoisted(() => vi.fn())
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/candidate', () => ({ setAwesomeInterest: setAwesomeInterestMock }))
vi.mock('@/modules/identity', () => ({ resolveActorWithFingerprint: resolveActorMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { POST } from './route'

describe('POST /api/awesome/[slug]/interest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveActorMock.mockResolvedValue({
      actorType: 'anonymous',
      actorKey: 'anonymous:anon-1',
      anonymousUserId: 'anon-1',
    })
  })

  it('records a valid score and revalidates the public queue', async () => {
    setAwesomeInterestMock.mockResolvedValue({
      totalScore: 9,
      averageScore: 4.5,
      ratingCount: 2,
      myScore: 5,
    })
    const request = new NextRequest('http://localhost/api/awesome/prompt-lab/interest', {
      method: 'POST',
      body: JSON.stringify({ score: 5, deviceFingerprint: '12345678-1234-1234-1234-123456789abc' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request, { params: Promise.resolve({ slug: 'prompt-lab' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      interest: {
        totalScore: 9,
        averageScore: 4.5,
        ratingCount: 2,
        myScore: 5,
      },
    })
    expect(setAwesomeInterestMock).toHaveBeenCalledWith('prompt-lab', 5, expect.objectContaining({
      anonymousUserId: 'anon-1',
    }))
    expect(revalidatePathMock).toHaveBeenCalledWith('/awesome')
  })

  it('rejects an out-of-range score before resolving an actor', async () => {
    const request = new NextRequest('http://localhost/api/awesome/prompt-lab/interest', {
      method: 'POST',
      body: JSON.stringify({ score: 8 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request, { params: Promise.resolve({ slug: 'prompt-lab' }) })

    expect(response.status).toBe(400)
    expect(resolveActorMock).not.toHaveBeenCalled()
    expect(setAwesomeInterestMock).not.toHaveBeenCalled()
  })
})
