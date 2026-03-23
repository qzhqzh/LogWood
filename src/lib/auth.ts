import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GitHubProvider from 'next-auth/providers/github'
import CredentialsProvider from 'next-auth/providers/credentials'
import { HttpsProxyAgent } from 'https-proxy-agent'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export type UserRole = 'admin' | 'user'

const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
const githubOAuthProxy = process.env.GITHUB_OAUTH_PROXY?.trim()
const nextAuthUrl = process.env.NEXTAUTH_URL || ''
const globalForAuthWarning = globalThis as typeof globalThis & {
  __logwoodAuthEnvWarned?: boolean
}

if (process.env.NODE_ENV === 'production' && !globalForAuthWarning.__logwoodAuthEnvWarned) {
  if (!nextAuthUrl) {
    console.warn('NEXTAUTH_URL is required in production')
  } else if (/localhost|127\.0\.0\.1/.test(nextAuthUrl)) {
    console.warn('NEXTAUTH_URL should not point to localhost in production')
  }

  globalForAuthWarning.__logwoodAuthEnvWarned = true
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
              ...(githubOAuthProxy
                ? {
                    agent: new HttpsProxyAgent(githubOAuthProxy),
                  }
                : {}),
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
            async authorize(credentials) {
              const email = credentials?.email?.trim().toLowerCase()
              const password = credentials?.password || ''

              if (!email || !password || email !== adminEmail.toLowerCase()) {
                return null
              }

              const plainMatched = adminPassword ? password === adminPassword : false
              const hashMatched = adminPasswordHash
                ? await bcrypt.compare(password, adminPasswordHash)
                : false

              if (!plainMatched && !hashMatched) {
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
