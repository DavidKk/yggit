import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/seo/landing-metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dev/', '/settings/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
