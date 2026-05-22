'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { sanitizeCallbackUrl } from '@/modules/identity/callback-url'
import { SiteFooter } from '@/components/site-footer'

const authErrorMessages: Record<string, string> = {
  OAuthSignin: 'GitHub OAuth 请求失败，请检查网络或代理配置。',
  OAuthCallback: 'GitHub 回调异常，请确认 Callback URL 配置正确。',
  OAuthCreateAccount: '使用 GitHub 创建账号失败，可能邮箱已被占用。',
  OAuthAccountNotLinked: '该邮箱已绑定其他登录方式，请使用原方式登录。',
  CredentialsSignin: '管理员邮箱或密码不正确。',
  SessionRequired: '需要登录后才能访问该页面。',
  Default: '登录过程中发生错误，请稍后重试。',
}

export default function SignInPage() {
  const { data: session, status } = useSession()
  const [providers, setProviders] = useState<Record<string, unknown> | null>(null)
  const [authError, setAuthError] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminSubmitting, setAdminSubmitting] = useState(false)
  const [adminError, setAdminError] = useState('')

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
    const errorCode = url.searchParams.get('error') || ''
    if (errorCode) {
      setAuthError(authErrorMessages[errorCode] || authErrorMessages.Default)
    }
  }, [])

  const githubEnabled = providers ? Boolean(providers.github) : false
  const adminEnabled = providers ? Boolean(providers['admin-credentials']) : false
  const providersLoading = providers === null

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

    setAdminError('')
    setAdminSubmitting(true)

    const result = await signIn('admin-credentials', {
      email: adminEmail,
      password: adminPassword,
      redirect: false,
      callbackUrl,
    })

    setAdminSubmitting(false)

    if (result?.error) {
      setAdminError('邮箱或密码不正确，请重试。')
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  // Loading state
  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
            <p className="text-gray-400">加载中...</p>
          </div>
        </div>
        <SiteFooter />
      </main>
    )
  }

  // Already authenticated
  if (status === 'authenticated') {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">你已登录</h1>
            <p className="text-gray-400 mb-4">可以继续访问管理功能。</p>
            <div className="text-xs text-gray-500 mb-6 space-y-1">
              <p>当前账号：{currentUserLabel}</p>
              <p>当前角色：{currentRoleLabel}</p>
            </div>
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
          <p className="text-gray-400 mb-6">
            支持 GitHub 普通用户登录（可评论）和系统管理员登录（可管理内容）。
          </p>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-300">{authError}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* GitHub OAuth Login */}
            {providersLoading && (
              <div className="w-full rounded-lg py-2 text-center text-gray-500 text-sm">
                正在加载登录方式...
              </div>
            )}

            {!providersLoading && githubEnabled && (
              <button
                type="button"
                onClick={() => signIn('github', { callbackUrl })}
                className="w-full cyber-button rounded-lg py-2.5 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                使用 GitHub 登录
              </button>
            )}

            {!providersLoading && !githubEnabled && !adminEnabled && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-300">
                  当前未启用任何登录方式，请在 <code className="bg-yellow-500/10 px-1 rounded">.env</code> 中配置 provider 环境变量后重启服务。
                </p>
              </div>
            )}

            {/* Admin Credentials Login */}
            {!providersLoading && adminEnabled && (
              <>
                {githubEnabled && (
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-gray-600/50" />
                    <span className="text-xs text-gray-500">或</span>
                    <div className="flex-1 h-px bg-gray-600/50" />
                  </div>
                )}
                <form onSubmit={submitAdminLogin} className="space-y-3 border border-cyan-500/20 rounded-lg p-4">
                  <p className="text-sm text-gray-300 font-medium">管理员登录</p>

                  {adminError && (
                    <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                      {adminError}
                    </p>
                  )}

                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="管理员邮箱"
                    required
                    autoComplete="email"
                    className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded px-3 py-2 text-[var(--color-text-strong)] placeholder:text-gray-500 focus:outline-none focus:border-cyan-400/60 transition-colors"
                  />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="管理员密码"
                    required
                    autoComplete="current-password"
                    className="w-full bg-[var(--color-surface-1)] border border-cyan-500/30 rounded px-3 py-2 text-[var(--color-text-strong)] placeholder:text-gray-500 focus:outline-none focus:border-cyan-400/60 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={adminSubmitting || !adminEmail || !adminPassword}
                    className="w-full border border-cyan-500/40 text-cyan-300 rounded-lg py-2 hover:bg-cyan-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adminSubmitting ? '登录中...' : '管理员登录'}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-5">
            GitHub 登录需配置 <code className="bg-gray-700/50 px-1 rounded">GITHUB_CLIENT_ID</code> 和 <code className="bg-gray-700/50 px-1 rounded">GITHUB_CLIENT_SECRET</code> 环境变量。
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline ml-1"
            >
              前往 GitHub 配置
            </a>
          </p>
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
