import type { MetadataRoute } from 'next'

import { LOCALE_HTML_LANG, LOCALES } from '@/lib/i18n'
import { SITE_URL } from '@/lib/seo/landing-metadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const alternateLanguages: Record<string, string> = {}
  for (const locale of LOCALES) {
    alternateLanguages[LOCALE_HTML_LANG[locale]] = locale === 'en' ? `${SITE_URL}/` : `${SITE_URL}/${locale}`
  }

  return LOCALES.map((locale) => ({
    url: locale === 'en' ? `${SITE_URL}/` : `${SITE_URL}/${locale}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: locale === 'en' ? 1.0 : 0.9,
    alternates: {
      languages: alternateLanguages,
    },
  }))
}
