'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeToggle } from '@/components/theme-toggle'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <div className="fixed bottom-4 right-4 z-[80]">
        <ThemeToggle />
      </div>
    </SessionProvider>
  )
}
