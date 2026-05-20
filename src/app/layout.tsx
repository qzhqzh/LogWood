import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://logwood.app'

export const metadata: Metadata = {
  title: {
    default: 'LogWood - AI 编码工具评测社区',
    template: '%s | LogWood',
  },
  description: '专注于 AI Coding 生态的评测社区，统一收录 AI Editor、AI Coding、AI Model 与 AI Prompt 工具和实践内容',
  keywords: ['AI编码工具', 'AI编程', 'AI代码评测', 'AI Editor', 'AI Coding', 'Claude', 'Cursor', 'Copilot', 'Prompt工具', 'AI Model'],
  authors: [{ name: 'LogWood Team' }],
  creator: 'LogWood',
  publisher: 'LogWood',
  formatDetection: {
    email: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: BASE_URL,
    siteName: 'LogWood',
    title: 'LogWood - AI 编码工具评测社区',
    description: '专注于 AI Coding 生态的评测社区，统一收录 AI Editor、AI Coding、AI Model 与 AI Prompt 工具和实践内容',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LogWood - AI 编码工具评测社区',
    description: '专注于 AI Coding 生态的评测社区，统一收录 AI Editor、AI Coding、AI Model 与 AI Prompt 工具和实践内容',
  },
  alternates: {
    canonical: BASE_URL,
  },
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
