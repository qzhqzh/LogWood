import { beforeEach, describe, expect, it, vi } from 'vitest'

const actorMock = vi.hoisted(() => vi.fn())
const listPublishedMock = vi.hoisted(() => vi.fn())
const submitMock = vi.hoisted(() => vi.fn())
const readFormMock = vi.hoisted(() => vi.fn())
const bundleMock = vi.hoisted(() => vi.fn())
vi.mock('@/modules/agent-skill-hub/service', () => ({
  hubActor: actorMock, listMyHubSkills: vi.fn(), listPublishedHubSkills: listPublishedMock,
  submitHubSkill: submitMock,
}))
vi.mock('@/modules/agent-skill-hub/bundle', async (original) => ({
  ...(await original<typeof import('@/modules/agent-skill-hub/bundle')>()),
  readLimitedMultipart: readFormMock,
  bundleFromForm: bundleMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { GET, POST } from './route'

describe('/api/awesome/skills/hub', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects anonymous publishing before touching multipart files', async () => {
    actorMock.mockResolvedValue(null)
    const response = await POST(new Request('http://localhost/api/awesome/skills/hub', {
      method: 'POST', body: 'untrusted large file',
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
    }))
    expect(response.status).toBe(401)
    expect(readFormMock).not.toHaveBeenCalled()
    expect(bundleMock).not.toHaveBeenCalled()
    expect(submitMock).not.toHaveBeenCalled()
  })

  it('returns only published metadata from the public listing', async () => {
    listPublishedMock.mockResolvedValue([{ name: 'demo', releases: [{ version: '1.0.0' }] }])
    const response = await GET(new Request('http://localhost/api/awesome/skills/hub'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ skills: [{ name: 'demo', releases: [{ version: '1.0.0' }] }] })
    expect(actorMock).not.toHaveBeenCalled()
  })
})
