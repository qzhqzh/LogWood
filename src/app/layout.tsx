import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'LogWood - AI 编码工具评测社区',
  description: '专注于 AI 编码工具的深度评测社区，帮助用户比较 AI Editor 和 AI Coding 工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0a0a0f] text-[#e0e0ff] font-['Rajdhani',sans-serif]">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
