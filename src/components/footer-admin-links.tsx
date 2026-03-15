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
      <Link href="/tags" className="text-gray-400 hover:text-cyan-300 transition-colors">
        标签管理
      </Link>
      <Link href="/comments/manage" className="text-gray-400 hover:text-cyan-300 transition-colors">
        评论管理
      </Link>
    </>
  )
}
