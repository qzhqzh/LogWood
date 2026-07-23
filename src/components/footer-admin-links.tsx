'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

export function FooterAdminLinks() {
  const { data: session, status } = useSession()

  if (status !== 'authenticated' || session?.user?.role !== 'admin') {
    return null
  }

  return (
    <>
      <Link href="/candidates/manage" className="text-muted hover:text-amber-200 transition-colors">
        灵感管理
      </Link>
      <Link href="/skills/manage" className="text-muted hover-text-coding transition-colors">
        Skill 管理
      </Link>
      <Link href="/evaluations/manage" className="text-muted hover:text-emerald-200 transition-colors">
        正式评测
      </Link>
      <Link href="/tags" className="text-muted hover-text-coding transition-colors">
        标签管理
      </Link>
      <Link href="/comments/manage" className="text-muted hover-text-coding transition-colors">
        评论管理
      </Link>
    </>
  )
}
