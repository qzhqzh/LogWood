import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getSessionMock = vi.hoisted(() => vi.fn())
const listMock = vi.hoisted(() => vi.fn())
const createMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())
const revalidateMock = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: getSessionMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidateMock }))
vi.mock('@/modules/candidate/skill-catalog-management', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/candidate/skill-catalog-management')>()),
  listManagedAgentSkills: listMock,
  createManagedAgentSkill: createMock,
  updateManagedAgentSkill: updateMock,
}))

import { GET, PATCH, POST } from './route'

describe('/api/awesome/skills/manage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects anonymous and non-admin reads and writes before accessing data', async () => {
    const url = 'http://localhost/api/awesome/skills/manage'
    expect((await GET(new NextRequest(url))).status).toBe(403)
    getSessionMock.mockResolvedValue({ user: { id: 'user-1', role: 'user' } })
    expect((await POST(new NextRequest(url, { method: 'POST', body: '{}' }))).status).toBe(403)
    expect((await PATCH(new NextRequest(url, { method: 'PATCH', body: '{}' }))).status).toBe(403)
    expect(listMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('exports only to an admin with a stable schema marker', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    listMock.mockResolvedValue([{ id: 'id-1', title: 'Sepia' }])
    const response = await GET(new NextRequest('http://localhost/api/awesome/skills/manage?export=1'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('logwood-agent-skills.json')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({
      schema: 'logwood.skill-catalog.export.v1', skills: [{ id: 'id-1', title: 'Sepia' }],
    })
  })

  it('validates admin submissions before persisting', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const response = await POST(new NextRequest('http://localhost/api/awesome/skills/manage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Bad' }),
    }))
    expect(response.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })
})
