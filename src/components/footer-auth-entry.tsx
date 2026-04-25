'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'

export function FooterAuthEntry() {
  const { data: session, status } = useSession()

  if (status !== 'authenticated' || !session?.user?.id) {
    return (
      <Link href="/auth/signin" className="text-muted hover-text-coding transition-colors">
        登录入口
      </Link>
    )
  }

  const isAdmin = session.user.role === 'admin'
  const githubName = session.user.name?.trim()
    || session.user.email?.split('@')[0]
    || '普通用户'
  const userLabel = isAdmin ? '管理员' : githubName

  return (
    <div className="inline-flex items-center gap-2 text-muted">
      <Link href="/auth/signin" className="hover-text-coding transition-colors">
        {userLabel}
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        aria-label="退出登录"
        title="退出登录"
        className="text-muted hover:text-[var(--color-danger-text)] transition-colors"
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
