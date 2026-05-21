import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { JsonLd } from '@/components/json-ld'
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  TWITTER_CARD,
  buildOrganization,
  canonicalFor,
  getSiteUrl,
} from '@/shared/seo'

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - AI 编码工具评测社区`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: `${SITE_NAME} Team` }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
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
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - AI 编码工具评测社区`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - AI 编码工具评测社区`,
      },
    ],
  },
  twitter: {
    card: TWITTER_CARD,
    title: `${SITE_NAME} - AI 编码工具评测社区`,
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: canonicalFor('/'),
    languages: { 'zh-CN': '/' },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
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
        <JsonLd value={buildOrganization()} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
