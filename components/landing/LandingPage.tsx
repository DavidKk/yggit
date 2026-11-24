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

const TIME_PRESET_STORAGE_KEY = 'yggit.landing.timePreset'

function getAutoTimePreset(): 'day' | 'night' {
  if (typeof window === 'undefined') return 'night'
  try {
    const saved = localStorage.getItem(TIME_PRESET_STORAGE_KEY)
    if (saved === 'day' || saved === 'night') return saved
  } catch {}

  const hour = new Date().getHours()
  // Daytime is strictly between 06:00 and 18:00
  if (hour >= 6 && hour < 18) {
    // If user's OS explicitly prefers dark mode, default to night
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'night'
    }
    return 'day'
  }
  return 'night'
}

export function LandingPage() {
  const t = useT()
  const isDesktopViewport = useSyncExternalStore(subscribeToViewport, getDesktopViewport, getServerDesktopViewport)
  const [timePresetId, setTimePresetId] = useState<'day' | 'night'>(() => {
    return typeof window !== 'undefined' ? getAutoTimePreset() : 'night'
  })

  useEffect(() => {
    setTimePresetId(getAutoTimePreset())
  }, [])

  const handleToggleDayNight = () => {
    setTimePresetId((prev) => {
      const next = prev === 'day' ? 'night' : 'day'
      try {
        localStorage.setItem(TIME_PRESET_STORAGE_KEY, next)
      } catch {}
      return next
    })
  }

  const handleSelectPreset = (preset: { id: string }) => {
    const next = preset.id === 'night' ? 'night' : 'day'
    setTimePresetId(next)
    try {
      localStorage.setItem(TIME_PRESET_STORAGE_KEY, next)
    } catch {}
  }

  return (
    <main className={styles.page} data-scene={timePresetId}>
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
