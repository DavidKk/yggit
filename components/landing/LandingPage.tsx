'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { LuMonitor } from 'react-icons/lu'

import { YggitOfficialPreview } from '@/components/homepage/YggitOfficialPreview'
import { useT } from '@/components/i18n/LocaleProvider'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingHero } from '@/components/landing/LandingHero'

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

function getAutoTimePreset(): 'day' | 'night' {
  const hour = new Date().getHours()
  return hour >= 6 && hour < 18 ? 'day' : 'night'
}

export function LandingPage() {
  const t = useT()
  const isDesktopViewport = useSyncExternalStore(subscribeToViewport, getDesktopViewport, getServerDesktopViewport)
  const [timePresetId, setTimePresetId] = useState<'day' | 'night'>('day')

  useEffect(() => {
    setTimePresetId(getAutoTimePreset())
  }, [])

  return (
    <main className={styles.page} data-scene={timePresetId}>
      <LandingHeader timePresetId={timePresetId} onToggleDayNight={() => setTimePresetId((prev) => (prev === 'day' ? 'night' : 'day'))} />
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
            onSelectTimePreset={(preset) => setTimePresetId(preset.id === 'night' ? 'night' : 'day')}
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
