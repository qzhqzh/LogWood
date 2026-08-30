import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { JsonLd } from '@/components/json-ld'
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TAGLINE,
  TWITTER_CARD,
  buildOrganization,
  canonicalFor,
  getSiteUrl,
} from '@/shared/seo'

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME }],
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
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: TWITTER_CARD,
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
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
            __html: `(function(){try{var stored=localStorage.getItem('logwood-theme');document.documentElement.dataset.theme=stored==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`,
          }}
        />
      </head>
      <body className="bg-[var(--color-bg)] text-[var(--color-fg)] font-sans transition-colors duration-300">
        <div
          aria-hidden="true"
          className="hidden"
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: Prompt is a practiced capability: the recipe and its real model output belong in one inspectable frame, never in a generic content dashboard.
OWN-WORLD: Near-black phosphor or warm-paper field, fine square rules, restrained green selection, sparse amber evidence, flat panels, and one controlled glitch event.
STORY: Enter through a complete PROMPT signal field, choose a real record, edit a private test copy, run text or image models, and inspect the centered result.
FIRST VIEWPORT: Framed KongXin navigation, a dominant glitching PROMPT, PROMPTS, PROVEN., one ENTER control, and a truthful status rail fill the viewport.
FORM: User-approved comp-led Home and three-region Prompt Workbench, docs/design/phase-1-*-concept.png; text and image run, other outputs remain managed-only.
FINISH: Unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->`,
          }}
        />
        <JsonLd value={buildOrganization()} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
