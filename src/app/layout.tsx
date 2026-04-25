import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'LogWood - AI 编码工具评测社区',
  description: '专注于 AI Coding 生态的评测社区，统一收录 AI Editor、AI Coding、AI Model 与 AI Prompt 工具和实践内容',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var stored=localStorage.getItem('logwood-theme');var systemDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var theme=stored||(systemDark?'dark':'light');document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme='dark';}})();`,
          }}
        />
      </head>
      <body className="bg-[var(--color-bg)] text-[var(--color-fg)] font-sans transition-colors duration-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
