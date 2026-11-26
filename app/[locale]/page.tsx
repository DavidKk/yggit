import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { LandingPage } from '@/components/landing/LandingPage'
import { isLocale } from '@/lib/i18n'
import { buildLandingJsonLd, buildLandingMetadata, buildWebSiteJsonLd, LANDING_SUBPATH_LOCALES } from '@/lib/seo/landing-metadata'

export function generateStaticParams() {
  return LANDING_SUBPATH_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale) || locale === 'en') {
    return buildLandingMetadata('en')
  }
  return buildLandingMetadata(locale)
}

export default async function LocalizedLandingPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  if (locale === 'en') {
    redirect('/')
  }
  if (!isLocale(locale)) {
    notFound()
  }

  const appJsonLd = buildLandingJsonLd(locale)
  const siteJsonLd = buildWebSiteJsonLd(locale)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      <LandingPage />
    </>
  )
}
