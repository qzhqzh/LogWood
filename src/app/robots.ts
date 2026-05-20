import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://logwood.app'
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
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
