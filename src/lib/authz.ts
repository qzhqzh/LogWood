import { Session } from 'next-auth'

export type SessionRole = 'admin' | 'user'

export function getSessionRole(session: Session | null | undefined): SessionRole {
  if (session?.user?.role === 'admin') {
    return 'admin'
  }
  return 'user'
}

export function isAdminSession(session: Session | null | undefined): boolean {
  return getSessionRole(session) === 'admin'
}
