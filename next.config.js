/** @type {import('next').NextConfig} */

// Security response headers applied to every Next.js-handled route.
//
// Nginx (`nginx/nginx.conf`) layers a few of the same headers on top, but only
// for paths that nginx serves directly (e.g. `/uploads/`). Setting them here
// guarantees that proxied app responses also carry them; duplicates between
// Next and Nginx are harmless because both set the same value.
//
// CSP starts in *report-only* mode so we can observe violations in production
// without blocking the rich-text editor (Tiptap), the inline theme bootstrap
// script in `src/app/layout.tsx`, or any third-party tool logo. After a few
// days of clean reports, the header name should be flipped to
// `Content-Security-Policy` (enforce mode) and `'unsafe-inline'` for scripts
// should be replaced with a per-request nonce.
const isProd = process.env.NODE_ENV === 'production'

const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-inline' covers the theme bootstrap script and JSON-LD blocks.
  // Next.js framework scripts are loaded from the same origin so 'self' covers them.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind / inline styles + Next.js style tags.
  "style-src 'self' 'unsafe-inline'",
  // External tool logos and article cover images can come from any HTTPS host
  // because users paste arbitrary URLs (see `images.remotePatterns` below).
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Same-origin XHR/fetch only. NextAuth.js OAuth flows happen via top-level
  // navigation, not fetch, so this is safe.
  "connect-src 'self'",
  "media-src 'self' blob: https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  // 2-year HSTS with subdomain coverage. Safe to set even when this Next.js
  // server is reached over HTTP from the upstream proxy because the browser
  // only sees the upstream HTTPS response and applies HSTS based on that.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Lock down APIs the app does not use. Add to this allowlist if a future
  // feature legitimately needs the capability.
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'screen-wake-lock=()',
      'sync-xhr=(self)',
      'usb=()',
      'web-share=(self)',
      'xr-spatial-tracking=()',
    ].join(', '),
  },
  {
    // Report-only first; flip to enforce mode after observing real traffic.
    key: 'Content-Security-Policy-Report-Only',
    value: cspDirectives,
  },
]

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Only allow images from known sources. All article/app images are
    // uploaded by admins to local /uploads/ (served by same origin).
    // GitHub avatars are needed for OAuth user profiles.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
