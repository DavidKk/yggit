'use client'

import Link from 'next/link'
import React from 'react'
import { LuArrowRight, LuCompass, LuMoon, LuSun } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { Button } from '@/components/sk'
import { cn } from '@/lib/utils'

export interface LandingHeaderProps {
  timePresetId?: 'day' | 'night'
  onToggleDayNight?: () => void
  className?: string
}

export function LandingHeader({ timePresetId = 'day', onToggleDayNight, className }: LandingHeaderProps) {
  const t = useT()
  const isDay = timePresetId === 'day'

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-40 flex h-14 items-center justify-between px-5 sm:px-8 lg:px-12',
        'border-b border-white/10 bg-[#03090d]/65 backdrop-blur-md shadow-xs transition-colors duration-500',
        className
      )}
    >
      {/* Left: Brand Logo & Navigation Links */}
      <div className="flex items-center gap-8">
        <BrandLogo href="/" className="shrink-0" markClassName="size-7" wordmarkClassName="text-base font-bold text-white tracking-tight" />

        <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium text-slate-300">
          <Link href="/workdesk" className="hover:text-accent transition-colors no-underline">
            {t('workdesk.topbarTitle')}
          </Link>
          <Link href="/git" className="hover:text-accent transition-colors no-underline">
            {t('landing.header.gitWorkspace')}
          </Link>
          {process.env.NODE_ENV === 'development' && (
            <Link href="/dev/studio" className="flex items-center gap-1.5 text-accent hover:text-accent/80 transition-colors no-underline">
              <LuCompass className="size-3.5" />
              <span>{t('landing.header.devStudio')}</span>
            </Link>
          )}
        </nav>
      </div>

      {/* Right: Actions, Day/Night Switcher, Locale Switcher, CTA */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        <LocaleSwitcher
          compact
          className="z-50"
          triggerClassName="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors cursor-pointer data-[popup-open]:bg-white/15 data-[popup-open]:border-white/25"
        />

        {onToggleDayNight && (
          <button
            type="button"
            onClick={onToggleDayNight}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            aria-label={isDay ? t('landing.header.dayAria') : t('landing.header.nightAria')}
            title={isDay ? t('landing.header.dayTitle') : t('landing.header.nightTitle')}
          >
            {isDay ? (
              <>
                <LuSun className="size-3.5 text-amber-400" />
                <span className="hidden sm:inline">{t('landing.header.day')}</span>
              </>
            ) : (
              <>
                <LuMoon className="size-3.5 text-teal-300" />
                <span className="hidden sm:inline">{t('landing.header.night')}</span>
              </>
            )}
          </button>
        )}

        <Link href="/workdesk" className="no-underline">
          <Button variant="accent" size="sm" className="gap-1.5 shadow-sm font-semibold">
            <span>{t('workdesk.topbarTitle')}</span>
            <LuArrowRight className="size-3.5" />
          </Button>
        </Link>
      </div>
    </header>
  )
}
