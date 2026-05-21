import { MetadataRoute } from 'next'
import { canonicalFor } from '@/shared/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/app/manage/',
        '/articles/manage/',
        '/comments/manage/',
        '/targets/manage/',
        '/auth/',
        '/submit',
        '/emojis',
        '/tags',
      ],
    },
    sitemap: canonicalFor('/sitemap.xml'),
  }
}
