import type { Metadata } from 'next'
import { Orbitron, Rajdhani } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-orbitron',
  display: 'swap',
})

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-rajdhani',
  display: 'swap',
})

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
    <html lang="zh-CN" className={`${orbitron.variable} ${rajdhani.variable}`}>
      <body className="bg-[#0a0a0f] text-[#e0e0ff] font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
