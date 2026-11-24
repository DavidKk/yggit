'use client'

import Link from 'next/link'
import { FaGithub } from 'react-icons/fa'
import { LuCompass, LuMoon, LuSun } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { cn } from '@/lib/utils'

import styles from './LandingPage.module.css'

export interface LandingHeaderProps {
  timePresetId?: 'day' | 'night'
  onToggleDayNight?: () => void
  className?: string
}

export function LandingHeader({ timePresetId = 'day', onToggleDayNight, className }: LandingHeaderProps) {
  const t = useT()
  const isDay = timePresetId === 'day'

  return (
    <header className={cn(styles.header, className)}>
      <div className={styles.navigation}>
        <BrandLogo href="/" className="shrink-0" markClassName={styles.mark} wordmarkClassName={styles.wordmark} />

        <nav className={styles.links}>
          <Link href="/workdesk">{t('workdesk.topbarTitle')}</Link>
          <Link href="/git">{t('landing.header.gitWorkspace')}</Link>
          {process.env.NODE_ENV === 'development' && (
            <Link href="/dev/studio" className={styles.studio}>
              <LuCompass aria-hidden />
              <span>{t('landing.header.devStudio')}</span>
            </Link>
          )}
        </nav>
      </div>

      <div className={styles.controls}>
        <LocaleSwitcher triggerClassName={styles.control} />
        {onToggleDayNight && (
          <button
            type="button"
            onClick={onToggleDayNight}
            className={cn(styles.control, styles.theme)}
            aria-label={isDay ? t('landing.header.dayAria') : t('landing.header.nightAria')}
            title={isDay ? t('landing.header.dayTitle') : t('landing.header.nightTitle')}
          >
            {isDay ? <LuSun aria-hidden /> : <LuMoon aria-hidden />}
            <span>{isDay ? t('landing.header.day') : t('landing.header.night')}</span>
          </button>
        )}

        <a href="https://github.com/DavidKk/yggit" className={styles.control}>
          <FaGithub aria-hidden />
          <span>GitHub</span>
        </a>
      </div>
    </header>
  )
}
