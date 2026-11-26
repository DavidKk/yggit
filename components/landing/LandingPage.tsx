'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { LuMonitor } from 'react-icons/lu'

import { HERO_ASSETS } from '@/components/homepage/data/heroAssets'
import { YggitOfficialPreview } from '@/components/homepage/YggitOfficialPreview'
import { useT } from '@/components/i18n/LocaleProvider'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingHero } from '@/components/landing/LandingHero'
import { type LandingScene, resolveBrowserLandingScene, writeLandingScene } from '@/lib/landing/scene'

import styles from './LandingPage.module.css'

const desktopViewport = '(min-width: 900px) and (min-aspect-ratio: 6/5)'

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(desktopViewport)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getDesktopViewport() {
  return window.matchMedia(desktopViewport).matches
}

function getServerDesktopViewport() {
  return false
}

export function LandingPage({ initialScene = 'night' }: { initialScene?: LandingScene }) {
  const t = useT()
  const isDesktopViewport = useSyncExternalStore(subscribeToViewport, getDesktopViewport, getServerDesktopViewport)
  // Start from the SSR cookie-resolved scene to prevent hydration mismatches and Day/Night flashes.
  const [timePresetId, setTimePresetId] = useState<LandingScene>(initialScene)

  useEffect(() => {
    const resolved = resolveBrowserLandingScene()
    setTimePresetId(resolved)
    writeLandingScene(resolved)
  }, [])

  const handleToggleDayNight = () => {
    setTimePresetId((prev) => {
      const next = prev === 'day' ? 'night' : 'day'
      writeLandingScene(next)
      return next
    })
  }

  const handleSelectPreset = (preset: { id: string }) => {
    const next = preset.id === 'night' ? 'night' : 'day'
    setTimePresetId(next)
    writeLandingScene(next)
  }

  const activeSceneHref = timePresetId === 'day' ? HERO_ASSETS.landingDayBase : HERO_ASSETS.landingNightBase
  const activeOverhangHref = timePresetId === 'day' ? HERO_ASSETS.dayOverhang : HERO_ASSETS.nightOverhang

  return (
    <main className={styles.page} data-scene={timePresetId}>
      <link rel="preload" as="image" href={activeSceneHref} fetchPriority="high" />
      <link rel="preload" as="image" href={HERO_ASSETS.cardShell} fetchPriority="high" />
      <link rel="preload" as="image" href={activeOverhangHref} fetchPriority="high" />
      <LandingHeader timePresetId={timePresetId} onToggleDayNight={handleToggleDayNight} />
      <LandingHero />
      <div className={styles.stage}>
        {isDesktopViewport && (
          <YggitOfficialPreview
            view="official-site"
            compactBannerMode
            hideTopNav
            hideLeftCopy
            fullScreenStage
            timePresetId={timePresetId}
            onSelectTimePreset={handleSelectPreset}
          />
        )}
      </div>
      <div className={styles.desktopNotice}>
        <LuMonitor aria-hidden />
        <h1>Yggit</h1>
        <p>{t('landing.desktopNotice')}</p>
      </div>
    </main>
  )
}
