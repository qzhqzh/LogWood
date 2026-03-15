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
    <html lang="zh-CN">
      <body className="bg-[#0a0a0f] text-[#e0e0ff] font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
