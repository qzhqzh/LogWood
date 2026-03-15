import type { Session } from 'next-auth'
import { describe, expect, it } from 'vitest'
import { getSessionRole, isAdminSession } from '@/lib/authz'

function buildSession(role?: 'admin' | 'user'): Session {
  return {
    expires: '2099-01-01T00:00:00.000Z',
    user: {
      id: 'user-id',
      email: 'test@example.com',
      role: role || 'user',
      name: 'tester',
    },
  }
}

describe('authz helpers', () => {
  it('returns admin role for admin session', () => {
    const session = buildSession('admin')
    expect(getSessionRole(session)).toBe('admin')
    expect(isAdminSession(session)).toBe(true)
  })

  it('returns user role for normal session', () => {
    const session = buildSession('user')
    expect(getSessionRole(session)).toBe('user')
    expect(isAdminSession(session)).toBe(false)
  })

  it('falls back to user for missing or malformed role', () => {
    const session = {
      ...buildSession(),
      user: {
        ...buildSession().user,
        role: 'unknown',
      },
    } as unknown as Session

    expect(getSessionRole(session)).toBe('user')
    expect(isAdminSession(undefined)).toBe(false)
    expect(isAdminSession(null)).toBe(false)
  })
})
