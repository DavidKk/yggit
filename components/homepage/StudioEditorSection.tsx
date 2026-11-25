'use client'

import React, { type CSSProperties, useEffect, useRef, useState } from 'react'
import { LuCalendar, LuMoon, LuPanelRight, LuPanelRightClose, LuRotateCcw, LuSun, LuWind } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingHero } from '@/components/landing/LandingHero'
import landingStyles from '@/components/landing/LandingPage.module.css'
import { Badge, ScrollArea, Tooltip } from '@/components/sk'
import { SwitchToggle } from '@/components/sk/Switch'
import { cn } from '@/lib/utils'

import { SEASON_THEMES, SeasonThemePack, TIME_OF_DAY_PRESETS, TimeOfDayPreset } from './data/worldTreeData'
import { LightingConfig, WindConfig } from './LivingTreeCanvas'
import { YggitOfficialPreview } from './YggitOfficialPreview'

interface StudioEditorSectionProps {
  wind: WindConfig
  onChangeWind: React.Dispatch<React.SetStateAction<WindConfig>>
  lighting: LightingConfig
  onChangeLighting: React.Dispatch<React.SetStateAction<LightingConfig>>
  timePresetId: TimeOfDayPreset['id']
  onSelectTimePreset: (preset: TimeOfDayPreset) => void
  seasonId: SeasonThemePack['id']
  onChangeSeason: (id: SeasonThemePack['id']) => void
}

type InspectorTab = 'wind' | 'lighting' | 'seasons'

const VIRTUAL_STAGE_W = 1600
const VIRTUAL_STAGE_H = 900

function StudioSlider({
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  min: number
  max: number
  step: number
  value: number
  disabled?: boolean
  onChange: (next: number) => void
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, color-mix(in oklab, var(--ink) 14%, transparent) ${pct}%, color-mix(in oklab, var(--ink) 14%, transparent) 100%)`,
      }}
      className={cn(
        'h-1.5 w-full appearance-none rounded-full outline-none transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-45',
        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--panel)] [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110',
        '[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--accent)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--panel)] [&::-moz-range-thumb]:shadow-sm'
      )}
    />
  )
}

export function StudioEditorSection({ wind, onChangeWind, lighting, onChangeLighting, timePresetId, onSelectTimePreset, seasonId, onChangeSeason }: StudioEditorSectionProps) {
  const t = useT()
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('wind')
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const [stageScale, setStageScale] = useState(0.6)

  useEffect(() => {
    const el = stageContainerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const updateScale = () => {
      const availW = Math.max(320, el.clientWidth - 32)
      const availH = Math.max(240, el.clientHeight - 32)
      const next = Math.min(1, availW / VIRTUAL_STAGE_W, availH / VIRTUAL_STAGE_H)
      setStageScale(Math.max(0.25, next))
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const activeSeason = SEASON_THEMES.find((s) => s.id === seasonId) || SEASON_THEMES[0]

  const handleResetWind = () => {
    onChangeWind({
      enabled: true,
      directionDeg: 18,
      strength: 0.46,
      gustiness: 0.35,
      showMeshWireframe: false,
      showAnchors: true,
      showNodes: false,
      showBounds: false,
    })
  }

  const handleResetLighting = () => {
    onChangeLighting({
      ambientBrightness: 1.08,
      temperature: 0.18,
      glowIntensity: 0.92,
      nodeIntensity: 0.95,
      fogAmount: 0.12,
      particlesEnabled: true,
      weatherRainSnow: 'none',
    })
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-paper text-ink select-none">
      {/* 1. Top IDE Toolbar (Photoshop / VS Code Style) */}
      <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line/60 bg-panel/90 px-3 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink min-w-0">
          <span className="hidden sm:inline truncate">World Tree Canvas Studio</span>
          <Badge tone="accent" size="mini">
            60 FPS WebGL
          </Badge>
        </div>

        {/* Center: Day / Night Quick Preset Buttons */}
        <div className="flex items-center justify-center gap-1">
          {TIME_OF_DAY_PRESETS.filter((preset) => preset.id === 'day' || preset.id === 'night').map((preset) => {
            const isSelected = preset.id === timePresetId
            const Icon = preset.id === 'day' ? LuSun : LuMoon
            const label = `${preset.name} (${preset.timeRange})`
            return (
              <Tooltip key={preset.id} content={label} placement="bottom">
                <button
                  type="button"
                  onClick={() => onSelectTimePreset(preset)}
                  aria-label={label}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md transition-all cursor-pointer',
                    isSelected ? 'bg-accent/15 text-accent shadow-xs ring-1 ring-accent/30' : 'text-ink-soft hover:bg-hover hover:text-ink'
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
            )
          })}
        </div>

        {/* Toolbar Right Controls */}
        <div className="flex items-center justify-end gap-1.5 text-xs">
          <Tooltip content={t('landing.studio.resetAll')} placement="bottom">
            <button
              type="button"
              onClick={() => {
                handleResetWind()
                handleResetLighting()
              }}
              aria-label={t('landing.studio.resetAll')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-hover hover:text-ink transition-colors cursor-pointer"
            >
              <LuRotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          </Tooltip>

          <div className="h-4 w-px bg-line/60 mx-0.5" />

          {/* Toggle Inspector Sidebar */}
          <Tooltip content={inspectorOpen ? t('landing.studio.collapseInspector') : t('landing.studio.expandInspector')} placement="bottom">
            <button
              type="button"
              onClick={() => setInspectorOpen((prev) => !prev)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer',
                inspectorOpen ? 'bg-accent/10 text-accent' : 'text-ink-soft hover:bg-hover hover:text-ink'
              )}
              aria-label={inspectorOpen ? t('landing.studio.collapseInspector') : t('landing.studio.expandInspector')}
            >
              {inspectorOpen ? <LuPanelRightClose className="size-4" aria-hidden="true" /> : <LuPanelRight className="size-4" aria-hidden="true" />}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* 2. Main Work Area: Scrollable Center Stage + Docked Right Inspector */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden relative">
        {/* Center Stage: Pixel-accurate 1600x900 Desktop Homepage Preview scaled proportionally */}
        <ScrollArea className="min-h-[420px] lg:min-h-0 min-w-0 flex-1 bg-paper-2" indicator="both" reserveGutter={false}>
          <div ref={stageContainerRef} className="relative flex min-h-full w-full flex-col items-center justify-center p-4">
            <div
              className="relative overflow-hidden rounded-xl border border-line/60 shadow-2xl"
              style={{ width: Math.round(VIRTUAL_STAGE_W * stageScale), height: Math.round(VIRTUAL_STAGE_H * stageScale) }}
            >
              <div
                data-scene={timePresetId === 'night' ? 'night' : 'day'}
                className={cn(landingStyles.page, 'relative overflow-hidden')}
                style={
                  {
                    width: VIRTUAL_STAGE_W,
                    height: VIRTUAL_STAGE_H,
                    transform: `scale(${stageScale})`,
                    transformOrigin: 'top left',
                    ['--unit' as string]: '0.957px',
                  } as CSSProperties
                }
              >
                <LandingHeader
                  timePresetId={timePresetId === 'night' ? 'night' : 'day'}
                  onToggleDayNight={() => {
                    const next = TIME_OF_DAY_PRESETS.find((p) => p.id === (timePresetId === 'night' ? 'day' : 'night'))
                    if (next) onSelectTimePreset(next)
                  }}
                />
                <LandingHero />
                <div className={landingStyles.stage}>
                  <YggitOfficialPreview
                    view="official-site"
                    compactBannerMode
                    hideTopNav
                    hideLeftCopy
                    fullScreenStage
                    seasonId={seasonId}
                    onChangeSeason={onChangeSeason}
                    timePresetId={timePresetId}
                    onSelectTimePreset={onSelectTimePreset}
                    wind={wind}
                    onChangeWind={onChangeWind}
                    lighting={lighting}
                  />
                </div>
              </div>
            </div>

            {/* Floating Stage Overlay Badge */}
            <div className="pointer-events-none absolute bottom-3 left-4 z-20 flex items-center gap-2 rounded-full border border-line/40 bg-panel/85 px-3 py-1 text-[11px] font-mono text-ink-soft backdrop-blur-md shadow-sm">
              <span className="size-2 rounded-full bg-ok animate-pulse" />
              <span>1600 × 900 ({Math.round(stageScale * 100)}%)</span>
              <span className="text-line">|</span>
              <span>{activeSeason.name}</span>
            </div>
          </div>
        </ScrollArea>

        {/* Right Docked Inspector (Photoshop / VS Code Style Secondary Sidebar) */}
        {inspectorOpen && (
          <aside
            aria-label="Studio Properties Inspector"
            className="flex w-full lg:w-80 xl:w-84 shrink-0 flex-col border-t lg:border-t-0 lg:border-l border-line/60 bg-panel/95 backdrop-blur-md transition-all duration-200 min-h-0 z-10"
          >
            {/* Segmented Tabs */}
            <div className="flex flex-col border-b border-line/60 bg-panel-2/30 p-2 shrink-0">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-panel p-0.5 border border-line/50">
                <button
                  type="button"
                  onClick={() => setInspectorTab('wind')}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-all cursor-pointer',
                    inspectorTab === 'wind' ? 'bg-accent/15 text-accent shadow-2xs font-semibold' : 'text-ink-soft hover:bg-hover hover:text-ink'
                  )}
                >
                  <LuWind className="size-3.5" />
                  <span>{t('landing.studio.tabWind')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('lighting')}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-all cursor-pointer',
                    inspectorTab === 'lighting' ? 'bg-accent/15 text-accent shadow-2xs font-semibold' : 'text-ink-soft hover:bg-hover hover:text-ink'
                  )}
                >
                  <LuSun className="size-3.5" />
                  <span>{t('landing.studio.tabLighting')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('seasons')}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-all cursor-pointer',
                    inspectorTab === 'seasons' ? 'bg-accent/15 text-accent shadow-2xs font-semibold' : 'text-ink-soft hover:bg-hover hover:text-ink'
                  )}
                >
                  <LuCalendar className="size-3.5" />
                  <span>{t('landing.studio.tabSeasons')}</span>
                </button>
              </div>
            </div>

            {/* Inspector Tab Content Container */}
            <ScrollArea className="min-h-0 flex-1" reserveGutter={false}>
              <div className="p-3 text-xs">
                {/* TAB 1: WIND DYNAMICS */}
                {inspectorTab === 'wind' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-line/40 pb-2.5">
                      <div>
                        <span className="font-semibold text-ink">{t('landing.studio.enableWind')}</span>
                        <p className="text-[11px] text-ink-soft">{t('landing.studio.enableWindDesc')}</p>
                      </div>
                      <SwitchToggle size="sm" checked={wind.enabled} onCheckedChange={(enabled) => onChangeWind((prev) => ({ ...prev, enabled }))} />
                    </div>

                    {/* Wind Strength */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{t('landing.studio.windStrength')}</span>
                        <span className="font-mono text-accent tabular-nums">{Math.round(wind.strength * 100)}%</span>
                      </div>
                      <StudioSlider
                        min={0}
                        max={1}
                        step={0.01}
                        value={wind.strength}
                        disabled={!wind.enabled}
                        onChange={(strength) => onChangeWind((prev) => ({ ...prev, strength }))}
                      />
                    </div>

                    {/* Wind Direction */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{t('landing.studio.windDirection')}</span>
                        <span className="font-mono text-accent tabular-nums">{Math.round(wind.directionDeg)}°</span>
                      </div>
                      <StudioSlider
                        min={-60}
                        max={60}
                        step={1}
                        value={wind.directionDeg}
                        disabled={!wind.enabled}
                        onChange={(directionDeg) => onChangeWind((prev) => ({ ...prev, directionDeg: Math.round(directionDeg) }))}
                      />
                    </div>

                    {/* Wind Gustiness */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{t('landing.studio.windGustiness')}</span>
                        <span className="font-mono text-accent tabular-nums">{Math.round(wind.gustiness * 100)}%</span>
                      </div>
                      <StudioSlider
                        min={0}
                        max={1}
                        step={0.01}
                        value={wind.gustiness}
                        disabled={!wind.enabled}
                        onChange={(gustiness) => onChangeWind((prev) => ({ ...prev, gustiness }))}
                      />
                    </div>

                    {/* Debug Overlays */}
                    <div className="flex flex-col gap-2 rounded-lg border border-line/50 bg-panel-2/30 p-2.5 mt-2">
                      <span className="font-semibold text-ink-soft text-[11px] uppercase tracking-wider">{t('landing.studio.debugOverlays')}</span>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-ink">{t('landing.studio.wireframe')}</span>
                        <SwitchToggle
                          size="sm"
                          checked={wind.showMeshWireframe}
                          onCheckedChange={(showMeshWireframe) => onChangeWind((prev) => ({ ...prev, showMeshWireframe }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-ink">{t('landing.studio.anchors')}</span>
                        <SwitchToggle size="sm" checked={wind.showAnchors} onCheckedChange={(showAnchors) => onChangeWind((prev) => ({ ...prev, showAnchors }))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: LIGHTING & ATMOSPHERE */}
                {inspectorTab === 'lighting' && (
                  <div className="flex flex-col gap-4">
                    {/* Ambient Brightness */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{t('landing.studio.ambient')}</span>
                        <span className="font-mono text-accent tabular-nums">{Math.round(lighting.ambientBrightness * 100)}%</span>
                      </div>
                      <StudioSlider
                        min={0.4}
                        max={1.6}
                        step={0.02}
                        value={lighting.ambientBrightness}
                        onChange={(ambientBrightness) => onChangeLighting((prev) => ({ ...prev, ambientBrightness }))}
                      />
                    </div>

                    {/* Glow Intensity */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{t('landing.studio.glowIntensity')}</span>
                        <span className="font-mono text-accent tabular-nums">{Math.round(lighting.glowIntensity * 100)}%</span>
                      </div>
                      <StudioSlider
                        min={0}
                        max={2.0}
                        step={0.05}
                        value={lighting.glowIntensity}
                        onChange={(glowIntensity) => onChangeLighting((prev) => ({ ...prev, glowIntensity }))}
                      />
                    </div>

                    {/* Fog Amount */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{t('landing.studio.fogAmount')}</span>
                        <span className="font-mono text-accent tabular-nums">{Math.round(lighting.fogAmount * 100)}%</span>
                      </div>
                      <StudioSlider min={0} max={0.6} step={0.01} value={lighting.fogAmount} onChange={(fogAmount) => onChangeLighting((prev) => ({ ...prev, fogAmount }))} />
                    </div>

                    {/* Particles Switch */}
                    <div className="flex items-center justify-between border-t border-line/40 pt-3">
                      <div>
                        <span className="font-semibold text-ink">{t('landing.studio.particles')}</span>
                        <p className="text-[11px] text-ink-soft">{t('landing.studio.particlesDesc')}</p>
                      </div>
                      <SwitchToggle
                        size="sm"
                        checked={lighting.particlesEnabled}
                        onCheckedChange={(particlesEnabled) => onChangeLighting((prev) => ({ ...prev, particlesEnabled }))}
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: SEASONS & SCHEDULING */}
                {inspectorTab === 'seasons' && (
                  <div className="flex flex-col gap-3">
                    <span className="font-semibold text-ink">{t('landing.studio.seasonsTitle')}</span>
                    <div className="grid grid-cols-2 gap-2">
                      {SEASON_THEMES.map((season) => {
                        const isSelected = season.id === seasonId
                        return (
                          <button
                            key={season.id}
                            type="button"
                            onClick={() => onChangeSeason(season.id)}
                            className={cn(
                              'flex flex-col items-start rounded-lg border p-2 transition-all cursor-pointer text-left',
                              isSelected ? 'border-accent bg-accent/15 text-accent font-bold shadow-xs' : 'border-line/60 bg-panel hover:bg-hover text-ink-soft hover:text-ink'
                            )}
                          >
                            <span className="text-xs">{season.name}</span>
                            <span className="text-[10px] text-ink-muted line-clamp-1">{season.scheduleRule}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="rounded-lg border border-line/60 bg-panel-2/40 p-2.5 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">{t('landing.studio.scheduleRule')}</span>
                        <span className="font-mono text-[11px] text-accent">{activeSeason.scheduleRule}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-soft leading-relaxed">{activeSeason.subtitle}</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>
    </div>
  )
}
