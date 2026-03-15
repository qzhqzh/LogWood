'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { SiteFooter } from '@/components/site-footer'

const errorMessageMap: Record<string, string> = {
  Configuration: '登录配置不完整，请检查服务端 provider 配置。',
  AccessDenied: '你没有权限访问该资源。',
  Verification: '登录链接已失效或已被使用，请重试。',
  Default: '登录过程中发生错误，请稍后重试。',
}

export default function AuthErrorPage() {
  const message = useMemo(() => {
    if (typeof window === 'undefined') return errorMessageMap.Default
    const url = new URL(window.location.href)
    const code = url.searchParams.get('error') || 'Default'
    return errorMessageMap[code] || errorMessageMap.Default
  }, [])

  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">登录失败</h1>
          <p className="text-gray-400 mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/auth/signin" className="cyber-button px-5 py-2 rounded-lg inline-block">
              返回登录
            </Link>
            <Link href="/" className="px-5 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 transition-colors inline-block">
              回到首页
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
