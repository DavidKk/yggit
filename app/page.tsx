import type { Metadata } from 'next'

import { LandingPage } from '@/components/landing/LandingPage'
import { resolveLandingScene } from '@/lib/landing/server'
import { buildLandingJsonLd, buildLandingMetadata, buildWebSiteJsonLd } from '@/lib/seo/landing-metadata'

export const metadata: Metadata = buildLandingMetadata('en')

const appJsonLd = buildLandingJsonLd('en')
const siteJsonLd = buildWebSiteJsonLd('en')

export default async function Home() {
  const initialScene = await resolveLandingScene()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      <LandingPage initialScene={initialScene} />
    </>
  )
}
