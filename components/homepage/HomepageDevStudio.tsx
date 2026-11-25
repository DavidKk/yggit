'use client'

import React, { useState } from 'react'
import { LuCompass, LuEye, LuFileCheck2, LuLayers, LuSlidersHorizontal } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

import { AuditAndDeliverablesView } from './AuditAndDeliverablesView'
import { SeasonThemePack, TimeOfDayPreset } from './data/worldTreeData'
import { LightingConfig, WindConfig } from './LivingTreeCanvas'
import { StudioAssetsSection } from './StudioAssetsSection'
import { StudioEditorSection } from './StudioEditorSection'
import { YggitOfficialPreview } from './YggitOfficialPreview'

export type StudioTabKey = 'editor' | 'assets' | 'audit' | 'preview'

export function HomepageDevStudio() {
  const t = useT()
  const [activeTab, setActiveTab] = useState<StudioTabKey>('editor')

  // Wind Configuration State
  const [wind, setWind] = useState<WindConfig>({
    enabled: true,
    directionDeg: 18,
    strength: 0.46,
    gustiness: 0.35,
    showMeshWireframe: false,
    showAnchors: true,
    showNodes: false,
    showBounds: false,
  })

  // Lighting & Micro-environment State
  const [lighting, setLighting] = useState<LightingConfig>({
    ambientBrightness: 1.08,
    temperature: 0.18,
    glowIntensity: 0.92,
    nodeIntensity: 0.95,
    fogAmount: 0.12,
    particlesEnabled: true,
    weatherRainSnow: 'none',
  })

  // Season & Time-of-day State
  const [seasonId, setSeasonId] = useState<SeasonThemePack['id']>('default')
  const [timePresetId, setTimePresetId] = useState<TimeOfDayPreset['id']>('day')

  const handleSelectTimePreset = (preset: TimeOfDayPreset) => {
    setTimePresetId(preset.id)
    setLighting((prev) => ({
      ...prev,
      ambientBrightness: preset.ambientBrightness,
      temperature: preset.temperature,
      glowIntensity: preset.glowIntensity,
      nodeIntensity: preset.nodeIntensity,
      fogAmount: preset.fogAmount,
    }))
  }

  const navItems = [
    {
      id: 'editor' as const,
      label: t('landing.studio.navEditor'),
      icon: <LuSlidersHorizontal className="size-4" aria-hidden="true" />,
    },
    {
      id: 'assets' as const,
      label: t('landing.studio.navAssets'),
      icon: <LuLayers className="size-4" aria-hidden="true" />,
    },
    {
      id: 'audit' as const,
      label: t('landing.studio.navAudit'),
      icon: <LuFileCheck2 className="size-4" aria-hidden="true" />,
    },
    {
      id: 'preview' as const,
      label: t('landing.studio.navPreview'),
      icon: <LuEye className="size-4" aria-hidden="true" />,
    },
  ]

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-paper text-ink">
      {/* 1. Left Vertical Icon Sidebar (Following SettingsSideNav Design) */}
      <aside aria-label="Homepage Studio Navigation" className="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-line bg-panel-2/40 py-3 md:w-14 select-none">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent mb-2">
          <LuCompass className="size-4.5" />
        </div>

        <nav className="flex flex-col items-center gap-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <Tooltip key={item.id} content={item.label} placement="right">
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent',
                    isActive ? 'bg-accent/15 text-accent shadow-xs' : 'text-ink-soft hover:bg-hover hover:text-ink'
                  )}
                >
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-accent" aria-hidden="true" />}
                  {item.icon}
                </button>
              </Tooltip>
            )
          })}
        </nav>
      </aside>

      {/* 2. Main Content Area */}
      <main className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink">
        {/* Tab 1: Editor — Full-bleed edge-to-edge IDE layout */}
        {activeTab === 'editor' && (
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
        )}

        {/* Tab 2: Assets */}
        {activeTab === 'assets' && (
          <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-line pb-4 mb-4">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{t('landing.studio.assetsTitle')}</h1>
                <Badge tone="accent">DEV ONLY</Badge>
              </div>
              <p className="text-xs text-ink-soft">{t('landing.studio.assetsSubtitle')}</p>
            </div>
            <StudioAssetsSection />
          </div>
        )}

        {/* Tab 3: Audit */}
        {activeTab === 'audit' && (
          <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-line pb-4 mb-4">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{t('landing.studio.auditTitle')}</h1>
                <Badge tone="accent">DEV ONLY</Badge>
              </div>
              <p className="text-xs text-ink-soft">{t('landing.studio.auditSubtitle')}</p>
            </div>
            <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
              <AuditAndDeliverablesView />
            </div>
          </div>
        )}

        {/* Tab 4: Preview */}
        {activeTab === 'preview' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#03090d]">
            <YggitOfficialPreview
              view="official-site"
              seasonId={seasonId}
              onChangeSeason={setSeasonId}
              timePresetId={timePresetId}
              onSelectTimePreset={handleSelectTimePreset}
              wind={wind}
              onChangeWind={setWind}
              lighting={lighting}
            />
          </div>
        )}
      </main>
    </div>
  )
}
