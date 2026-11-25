'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState } from 'react'
import { LuLayers, LuMoon, LuSlidersHorizontal, LuSun } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

import { StudioAssetsSection } from './StudioAssetsSection'
import { StudioProvider, useStudio } from './StudioContext'
import { StudioEditorSection } from './StudioEditorSection'

export type StudioTabKey = 'editor' | 'assets'

export function StudioShell({ children }: { children: React.ReactNode }) {
  const t = useT()
  const pathname = usePathname()

  const navItems = [
    {
      id: 'editor' as const,
      href: '/dev/studio/editor',
      label: t('landing.studio.navEditor'),
      icon: <LuSlidersHorizontal className="size-4" aria-hidden="true" />,
    },
    {
      id: 'assets' as const,
      href: '/dev/studio/assets',
      label: t('landing.studio.navAssets'),
      icon: <LuLayers className="size-4" aria-hidden="true" />,
    },
  ]

  return (
    <StudioProvider>
      <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-paper text-ink">
        {/* Left Vertical Secondary Navigation Rail */}
        <aside aria-label="Homepage Studio Navigation" className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-panel-2/40 py-3 md:w-14 select-none">
          <nav className="flex flex-col items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.id === 'editor' && pathname === '/dev/studio')
              return (
                <Tooltip key={item.id} content={item.label} placement="right">
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent',
                      isActive ? 'bg-accent/15 text-accent shadow-xs' : 'text-ink-soft hover:bg-hover hover:text-ink'
                    )}
                  >
                    {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-accent" aria-hidden="true" />}
                    {item.icon}
                  </Link>
                </Tooltip>
              )
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink">{children}</main>
      </div>
    </StudioProvider>
  )
}

export function StudioEditorView() {
  const { wind, setWind, lighting, setLighting, timePresetId, handleSelectTimePreset, seasonId, setSeasonId } = useStudio()
  return (
    <StudioEditorSection
      wind={wind}
      onChangeWind={setWind}
      lighting={lighting}
      onChangeLighting={setLighting}
      timePresetId={timePresetId}
      onSelectTimePreset={handleSelectTimePreset}
      seasonId={seasonId}
      onChangeSeason={setSeasonId}
    />
  )
}

export function StudioAssetsView() {
  const t = useT()
  const [isDay, setIsDay] = useState(true)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink">
      <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line/60 bg-panel/90 px-4">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xs font-bold tracking-tight text-ink truncate">{t('landing.studio.assetsTitle')}</h1>
          <Badge tone="accent" size="mini">
            DEV ONLY
          </Badge>
        </div>

        {/* Centered Day / Night Switcher */}
        <div className="flex items-center justify-center gap-1">
          <Tooltip content={t('landing.studio.dayMaster')} placement="bottom">
            <button
              type="button"
              onClick={() => setIsDay(true)}
              aria-label={t('landing.studio.dayMaster')}
              aria-pressed={isDay}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer',
                isDay ? 'bg-accent/15 text-accent shadow-xs ring-1 ring-accent/30' : 'text-ink-soft hover:bg-hover hover:text-ink'
              )}
            >
              <LuSun className="size-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content={t('landing.studio.nightMaster')} placement="bottom">
            <button
              type="button"
              onClick={() => setIsDay(false)}
              aria-label={t('landing.studio.nightMaster')}
              aria-pressed={!isDay}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer',
                !isDay ? 'bg-accent/15 text-accent shadow-xs ring-1 ring-accent/30' : 'text-ink-soft hover:bg-hover hover:text-ink'
              )}
            >
              <LuMoon className="size-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </header>
      <StudioAssetsSection isDay={isDay} />
    </div>
  )
}

export function HomepageDevStudio() {
  return (
    <StudioShell>
      <StudioEditorView />
    </StudioShell>
  )
}
