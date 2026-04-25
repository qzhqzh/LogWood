'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { sanitizeCallbackUrl } from '@/modules/identity/callback-url'
import { SiteFooter } from '@/components/site-footer'

export default function SignInPage() {
  const { data: session, status } = useSession()
  const [providers, setProviders] = useState<Record<string, unknown>>({})
  const [authError, setAuthError] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminSubmitting, setAdminSubmitting] = useState(false)

  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/'
    const url = new URL(window.location.href)
    return sanitizeCallbackUrl(url.searchParams.get('callbackUrl'), '/')
  }, [])

  useEffect(() => {
    fetch('/api/auth/providers', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setProviders(data || {}))
      .catch(() => setProviders({}))

    const url = new URL(window.location.href)
    setAuthError(url.searchParams.get('error') || '')
  }, [])

  const githubEnabled = Boolean(providers.github)
  const adminEnabled = Boolean(providers['admin-credentials'])

  const currentUserLabel = useMemo(() => {
    const name = session?.user?.name?.trim()
    const email = session?.user?.email?.trim()
    if (name) return name
    if (email) return email
    if (session?.user?.id) return `ID: ${session.user.id}`
    return '已认证用户'
  }, [session])

  const currentRoleLabel = session?.user?.role === 'admin' ? '系统管理员' : '普通用户'

  async function submitAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!adminEmail || !adminPassword) return

    setAdminSubmitting(true)
    await signIn('admin-credentials', {
      email: adminEmail,
      password: adminPassword,
      callbackUrl,
    })
    setAdminSubmitting(false)
  }

  if (status === 'authenticated') {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">你已登录</h1>
            <p className="text-gray-400 mb-2">可以继续访问管理功能。</p>
            <p className="text-xs text-gray-500 mb-6">当前账号：{currentUserLabel}</p>
            <p className="text-xs text-gray-500 mb-6">当前角色：{currentRoleLabel}</p>
            <Link href={callbackUrl} className="cyber-button px-5 py-2 rounded-lg inline-block">
              继续前往
            </Link>
          </div>
        </div>
        <SiteFooter />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">登录 LogWood</h1>
          <p className="text-gray-400 mb-6">支持两种登录：GitHub 普通用户（可评论）和系统管理员（可管理目标/App/文章）。</p>

        <div className="space-y-3">
          {githubEnabled && (
            <button
              type="button"
              onClick={() => signIn('github', { callbackUrl })}
              className="w-full cyber-button rounded-lg py-2"
            >
              使用 GitHub 登录
            </button>
          )}

          {!githubEnabled && !adminEnabled && (
            <p className="text-sm text-yellow-300">当前未启用可用登录 provider，请先配置环境变量后重启服务。</p>
          )}

          {adminEnabled && (
            <form onSubmit={submitAdminLogin} className="mt-4 space-y-2 border border-cyan-500/20 rounded-lg p-3">
              <p className="text-sm text-gray-300">管理员登录</p>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="管理员邮箱"
                className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded px-3 py-2 text-[var(--color-text-strong)]"
              />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="管理员密码"
                className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded px-3 py-2 text-[var(--color-text-strong)]"
              />
              <button
                type="submit"
                disabled={adminSubmitting}
                className="w-full border border-cyan-500/40 text-cyan-300 rounded-lg py-2 hover:bg-cyan-500/10 transition-colors disabled:opacity-70"
              >
                {adminSubmitting ? '登录中...' : '使用管理员账号登录'}
              </button>
            </form>
          )}
        </div>

        {authError && (
          <p className="text-xs text-red-300 mt-4">登录错误：{authError}</p>
        )}

          <p className="text-xs text-gray-500 mt-5">
            如按钮点击后提示 provider 不可用，请先在 `.env` 配置对应的 provider 环境变量。
          </p>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
