'use client'

import Link from 'next/link'
import React from 'react'
import { LuArrowRight, LuCompass, LuMoon, LuSun } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { Button } from '@/components/sk'
import { cn } from '@/lib/utils'

export interface LandingHeaderProps {
  timePresetId?: 'day' | 'night'
  onToggleDayNight?: () => void
  className?: string
}

export function LandingHeader({ timePresetId = 'day', onToggleDayNight, className }: LandingHeaderProps) {
  const t = useT()
  const locale = useLocaleCode()
  const isDay = timePresetId === 'day'
  const isZh = locale.startsWith('zh')

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
            {isZh ? 'Git 仓库' : 'Git Workspace'}
          </Link>
          {process.env.NODE_ENV === 'development' && (
            <Link href="/dev/studio" className="flex items-center gap-1.5 text-accent hover:text-accent/80 transition-colors no-underline">
              <LuCompass className="size-3.5" />
              <span>{isZh ? '官网工坊' : 'Dev Studio'}</span>
            </Link>
          )}
        </nav>
      </div>

      {/* Right: Actions, Day/Night Switcher, Star, CTA */}
      <div className="flex items-center gap-3">
        {onToggleDayNight && (
          <button
            type="button"
            onClick={onToggleDayNight}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            aria-label={isDay ? '切换至暗黑模式' : '切换至白天模式'}
            title={isDay ? '当前为白天模式，点击体验错峰平滑过渡至暗黑' : '当前为暗黑模式，点击体验错峰平滑过渡至白天'}
          >
            {isDay ? (
              <>
                <LuSun className="size-3.5 text-amber-400" />
                <span className="hidden sm:inline">{isZh ? '白天' : 'Day'}</span>
              </>
            ) : (
              <>
                <LuMoon className="size-3.5 text-teal-300" />
                <span className="hidden sm:inline">{isZh ? '暗黑' : 'Night'}</span>
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
