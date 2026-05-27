import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GitHubProvider from 'next-auth/providers/github'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { hashIp } from '@/lib/ip'
import { consumeIpSegmentLimit } from '@/modules/rate-limit'
import { logger } from '@/lib/logger'

export type UserRole = 'admin' | 'user'

const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
const adminGithubEmails = (process.env.ADMIN_GITHUB_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)
const nextAuthUrl = process.env.NEXTAUTH_URL || ''
const nextAuthSecret = process.env.NEXTAUTH_SECRET || ''

// Known weak/default values that must not be allowed in production.
// Keep this list in sync with .env.example and docker-compose.yml history.
const KNOWN_WEAK_SECRETS = new Set([
  'your-nextauth-secret-change-in-production',
  'change-me',
  'changeme',
  'secret',
  'nextauth-secret',
])

const globalForAuthWarning = globalThis as typeof globalThis & {
  __logwoodAuthEnvWarned?: boolean
}

if (process.env.NODE_ENV === 'production' && !globalForAuthWarning.__logwoodAuthEnvWarned) {
  // Hard fail: if secret is missing or known-weak in production we refuse to
  // boot. Failing fast here is much safer than starting with a forgeable
  // session token. See SECURITY_REVIEW R-08.
  if (!nextAuthSecret) {
    throw new Error(
      'NEXTAUTH_SECRET is required in production. Generate one with `openssl rand -base64 32`.',
    )
  }
  if (KNOWN_WEAK_SECRETS.has(nextAuthSecret) || nextAuthSecret.length < 32) {
    throw new Error(
      'NEXTAUTH_SECRET appears to be a default/weak value in production. ' +
        'Set a strong secret of at least 32 chars; generate one with `openssl rand -base64 32`.',
    )
  }

  if (!nextAuthUrl) {
    console.warn('NEXTAUTH_URL is required in production')
  } else if (/localhost|127\.0\.0\.1/.test(nextAuthUrl)) {
    console.warn('NEXTAUTH_URL should not point to localhost in production')
  }

  // Soft warn: plaintext admin password is acceptable for emergency access
  // but should be migrated to ADMIN_PASSWORD_HASH (bcrypt) in any real deploy.
  if (adminPassword && !adminPasswordHash) {
    console.warn(
      'ADMIN_PASSWORD is set in plaintext. Prefer ADMIN_PASSWORD_HASH (bcrypt) in production.',
    )
  }

  globalForAuthWarning.__logwoodAuthEnvWarned = true
}

/**
 * Pull a usable client IP from the NextAuth Credentials `req.headers` shape
 * (a plain object, not a Headers instance). Mirrors `getClientIp` in lib/ip
 * but adapted for that calling convention. Honours `LOGWOOD_TRUST_PROXY`.
 */
function ipFromAuthRequestHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): string {
  if (process.env.LOGWOOD_TRUST_PROXY !== 'true') return 'unknown'
  if (!headers) return 'unknown'

  const pick = (name: string) => {
    const value = headers[name] ?? headers[name.toLowerCase()]
    if (Array.isArray(value)) return value[0]
    return value
  }

  const xff = pick('x-forwarded-for') || ''
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = (pick('x-real-ip') || '').trim()
  if (real) return real
  return 'unknown'
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            httpOptions: {
              timeout: 60000,
            },
          }),
        ]
      : []),
    ...(adminEmail && (adminPassword || adminPasswordHash)
      ? [
          CredentialsProvider({
            id: 'admin-credentials',
            name: 'Admin Credentials',
            credentials: {
              email: { label: 'Email', type: 'email' },
              password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials, req) {
              const email = credentials?.email?.trim().toLowerCase()
              const password = credentials?.password || ''

              // Brute-force defence: charge the attempt to the IP segment
              // before doing any expensive work or revealing whether the
              // account exists. Counts both successful and failed tries so
              // an attacker cannot probe the account by alternating users.
              const ip = ipFromAuthRequestHeaders(req?.headers as any)
              const ipHash = hashIp(ip)
              const limit = await consumeIpSegmentLimit('admin_login_attempt', ipHash)
              if (!limit.allowed) {
                logger.warn('admin_login.rate_limited', { ipHash })
                return null
              }

              if (!email || !password || email !== adminEmail.toLowerCase()) {
                return null
              }

              const plainMatched = adminPassword ? password === adminPassword : false
              const hashMatched = adminPasswordHash
                ? await bcrypt.compare(password, adminPasswordHash)
                : false

              if (!plainMatched && !hashMatched) {
                logger.info('admin_login.failed', { ipHash })
                return null
              }

              // Ensure admin-credentials session maps to a real user row.
              // This avoids FK failures when creating records linked to users.
              const adminUser = await prisma.user.upsert({
                where: { email: adminEmail },
                update: {
                  name: '管理员',
                },
                create: {
                  email: adminEmail,
                  name: '管理员',
                },
              })

              return {
                id: adminUser.id,
                email: adminUser.email,
                name: adminUser.name || '管理员',
              }
            },
          }),
        ]
      : []),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }

      if (account?.provider === 'admin-credentials') {
        token.role = 'admin'
        token.authProvider = account.provider
      } else if (account?.provider === 'github') {
        // Check if GitHub user email is in admin list
        const userEmail = user.email?.toLowerCase()
        const isAdmin = userEmail && adminGithubEmails.includes(userEmail)
        token.role = isAdmin ? 'admin' : 'user'
        token.authProvider = account.provider
      } else if (account?.provider) {
        token.role = 'user'
        token.authProvider = account.provider
      } else if (!token.role) {
        token.role = 'user'
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        session.user.role = (token.role as UserRole | undefined) || 'user'
        session.user.authProvider = (token.authProvider as string | undefined) || 'unknown'
      }
      return session
    },
  },
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
      authProvider?: string
      name?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
    authProvider?: string
  }
}
