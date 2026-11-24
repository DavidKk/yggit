'use client'

import React, { useState } from 'react'
import { LuCalendar, LuMaximize2, LuMinimize2, LuPanelRight, LuPanelRightClose, LuRotateCcw, LuSparkles, LuSun, LuWind } from 'react-icons/lu'

import { Badge, Button, Tooltip } from '@/components/sk'
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

export function StudioEditorSection({ wind, onChangeWind, lighting, onChangeLighting, timePresetId, onSelectTimePreset, seasonId, onChangeSeason }: StudioEditorSectionProps) {
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('wind')
  const [stageFitMode, setStageFitMode] = useState<'fit' | 'fill'>('fit')

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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#020609] select-none">
      {/* 1. Top IDE Toolbar (Photoshop / VS Code Style) */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-line/60 bg-panel/90 px-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <LuSparkles className="size-4 text-accent" />
            <span className="hidden sm:inline">World Tree Canvas Studio</span>
            <Badge tone="accent">60 FPS WebGL</Badge>
          </div>

          <div className="hidden md:block h-4 w-px bg-line/60" />

          {/* Time-of-day Quick Preset Buttons */}
          <div className="flex items-center gap-1">
            {TIME_OF_DAY_PRESETS.map((preset) => {
              const isSelected = preset.id === timePresetId
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectTimePreset(preset)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-all cursor-pointer',
                    isSelected ? 'bg-accent/15 text-accent shadow-xs ring-1 ring-accent/30 font-semibold' : 'text-ink-soft hover:bg-hover hover:text-ink'
                  )}
                  title={`${preset.name} (${preset.timeRange})`}
                >
                  <LuSun className="size-3" />
                  <span>{preset.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Toolbar Right Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <Tooltip content={stageFitMode === 'fit' ? '填充视口 (Fill)' : '按比例自适应 (Fit)'}>
            <button
              type="button"
              onClick={() => setStageFitMode((prev) => (prev === 'fit' ? 'fill' : 'fit'))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-hover hover:text-ink transition-colors cursor-pointer"
              aria-label="Toggle stage fit mode"
            >
              {stageFitMode === 'fit' ? <LuMaximize2 className="size-3.5" /> : <LuMinimize2 className="size-3.5" />}
            </button>
          </Tooltip>

          <Tooltip content="重置全部参数">
            <button
              type="button"
              onClick={() => {
                handleResetWind()
                handleResetLighting()
              }}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-ink-soft hover:bg-hover hover:text-ink transition-colors cursor-pointer"
            >
              <LuRotateCcw className="size-3.5" />
              <span className="hidden lg:inline text-[11px]">重置</span>
            </button>
          </Tooltip>

          <div className="h-4 w-px bg-line/60 mx-1" />

          {/* Toggle Inspector Sidebar */}
          <Tooltip content={inspectorOpen ? '收起右侧属性检查器' : '展开右侧属性检查器'}>
            <button
              type="button"
              onClick={() => setInspectorOpen((prev) => !prev)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors cursor-pointer',
                inspectorOpen ? 'bg-accent/10 text-accent font-medium' : 'text-ink-soft hover:bg-hover hover:text-ink'
              )}
              aria-label="Toggle Inspector"
            >
              {inspectorOpen ? <LuPanelRightClose className="size-4" /> : <LuPanelRight className="size-4" />}
              <span className="hidden sm:inline text-[11px]">检查器</span>
            </button>
          </Tooltip>
        </div>
      </header>

      {/* 2. Main Work Area: Full-Bleed Center Stage + Docked Right Inspector */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Center Stage: Full-bleed edge-to-edge canvas */}
        <div className={cn('flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#03090d] relative', stageFitMode === 'fill' ? 'p-0' : 'p-2 sm:p-4')}>
          <div
            className={cn(
              'relative transition-all duration-200 overflow-hidden shadow-2xl',
              stageFitMode === 'fill' ? 'h-full w-full' : 'w-full max-h-full aspect-[16/9] rounded-xl border border-line/40'
            )}
          >
            <YggitOfficialPreview
              view="p1-p4-studio"
              seasonId={seasonId}
              onChangeSeason={onChangeSeason}
              timePresetId={timePresetId}
              onSelectTimePreset={onSelectTimePreset}
              wind={wind}
              onChangeWind={onChangeWind}
              lighting={lighting}
              fullScreenStage={stageFitMode === 'fill'}
            />
          </div>

          {/* Floating Stage Overlay Badge */}
          <div className="pointer-events-none absolute bottom-3 left-4 z-20 flex items-center gap-2 rounded-full border border-line/40 bg-panel/85 px-3 py-1 text-[11px] font-mono text-ink-soft backdrop-blur-md shadow-sm">
            <span className="size-2 rounded-full bg-ok animate-pulse" />
            <span>1672 × 941 Master</span>
            <span className="text-line">|</span>
            <span>{activeSeason.name}</span>
          </div>
        </div>

        {/* Right Docked Inspector (Photoshop / VS Code Style Secondary Sidebar) */}
        {inspectorOpen && (
          <aside
            aria-label="Studio Properties Inspector"
            className="flex w-80 sm:w-84 shrink-0 flex-col border-l border-line/60 bg-panel/95 backdrop-blur-md transition-all duration-200 min-h-0 z-10"
          >
            {/* Inspector Header & Segmented Tabs */}
            <div className="flex flex-col border-b border-line/60 bg-panel-2/30 p-2 gap-2 shrink-0">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">属性检查器 (Inspector)</span>
                <span className="text-[10px] font-mono text-accent">{activeSeason.name}</span>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-lg bg-panel p-0.5 border border-line/50">
                <button
                  type="button"
                  onClick={() => setInspectorTab('wind')}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-all cursor-pointer',
                    inspectorTab === 'wind' ? 'bg-accent/15 text-accent shadow-2xs font-semibold' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  <LuWind className="size-3.5" />
                  <span>风场</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('lighting')}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-all cursor-pointer',
                    inspectorTab === 'lighting' ? 'bg-accent/15 text-accent shadow-2xs font-semibold' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  <LuSun className="size-3.5" />
                  <span>光影</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('seasons')}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-all cursor-pointer',
                    inspectorTab === 'seasons' ? 'bg-accent/15 text-accent shadow-2xs font-semibold' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  <LuCalendar className="size-3.5" />
                  <span>四季</span>
                </button>
              </div>
            </div>

            {/* Inspector Tab Content Container */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-3 text-xs">
              {/* TAB 1: WIND DYNAMICS */}
              {inspectorTab === 'wind' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-line/40 pb-2.5">
                    <div>
                      <span className="font-semibold text-ink">激活物理风场仿真</span>
                      <p className="text-[11px] text-ink-soft">实时驱动网格变形与花草摆动</p>
                    </div>
                    <SwitchToggle checked={wind.enabled} onCheckedChange={(enabled) => onChangeWind((prev) => ({ ...prev, enabled }))} />
                  </div>

                  {/* Wind Strength */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">全局微风强度</span>
                      <span className="font-mono text-accent tabular-nums">{Math.round(wind.strength * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={wind.strength}
                      disabled={!wind.enabled}
                      onChange={(e) => {
                        const strength = parseFloat(e.target.value)
                        onChangeWind((prev) => ({ ...prev, strength }))
                      }}
                      className="h-1.5 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Wind Direction */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">主风向角 (度数)</span>
                      <span className="font-mono text-accent tabular-nums">{Math.round(wind.directionDeg)}°</span>
                    </div>
                    <input
                      type="range"
                      min="-60"
                      max="60"
                      step="1"
                      value={wind.directionDeg}
                      disabled={!wind.enabled}
                      onChange={(e) => {
                        const directionDeg = parseInt(e.target.value, 10)
                        onChangeWind((prev) => ({ ...prev, directionDeg }))
                      }}
                      className="h-1.5 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Wind Gustiness */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">阵风波动性 (Gustiness)</span>
                      <span className="font-mono text-accent tabular-nums">{Math.round(wind.gustiness * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={wind.gustiness}
                      disabled={!wind.enabled}
                      onChange={(e) => {
                        const gustiness = parseFloat(e.target.value)
                        onChangeWind((prev) => ({ ...prev, gustiness }))
                      }}
                      className="h-1.5 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Debug Overlays */}
                  <div className="flex flex-col gap-2 rounded-lg border border-line/50 bg-panel-2/30 p-2.5 mt-2">
                    <span className="font-semibold text-ink-soft text-[11px] uppercase tracking-wider">调试层标定</span>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-ink">网格线框 (Wireframe)</span>
                      <SwitchToggle size="sm" checked={wind.showMeshWireframe} onCheckedChange={(showMeshWireframe) => onChangeWind((prev) => ({ ...prev, showMeshWireframe }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-ink">锚点标定 (Anchors)</span>
                      <SwitchToggle size="sm" checked={wind.showAnchors} onCheckedChange={(showAnchors) => onChangeWind((prev) => ({ ...prev, showAnchors }))} />
                    </div>
                  </div>

                  <Button size="sm" variant="default" onClick={handleResetWind} className="mt-2 w-full gap-1.5 text-xs">
                    <LuRotateCcw className="size-3.5" />
                    <span>重置风场参数</span>
                  </Button>
                </div>
              )}

              {/* TAB 2: LIGHTING & ATMOSPHERE */}
              {inspectorTab === 'lighting' && (
                <div className="flex flex-col gap-4">
                  {/* Ambient Brightness */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">环境照度 (Ambient)</span>
                      <span className="font-mono text-accent tabular-nums">{Math.round(lighting.ambientBrightness * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="1.6"
                      step="0.02"
                      value={lighting.ambientBrightness}
                      onChange={(e) => {
                        const ambientBrightness = parseFloat(e.target.value)
                        onChangeLighting((prev) => ({ ...prev, ambientBrightness }))
                      }}
                      className="h-1.5 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Glow Intensity */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">树体与叶脉荧光强度</span>
                      <span className="font-mono text-accent tabular-nums">{Math.round(lighting.glowIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2.0"
                      step="0.05"
                      value={lighting.glowIntensity}
                      onChange={(e) => {
                        const glowIntensity = parseFloat(e.target.value)
                        onChangeLighting((prev) => ({ ...prev, glowIntensity }))
                      }}
                      className="h-1.5 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Fog Amount */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">山谷薄雾浓度 (Fog)</span>
                      <span className="font-mono text-accent tabular-nums">{Math.round(lighting.fogAmount * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.6"
                      step="0.01"
                      value={lighting.fogAmount}
                      onChange={(e) => {
                        const fogAmount = parseFloat(e.target.value)
                        onChangeLighting((prev) => ({ ...prev, fogAmount }))
                      }}
                      className="h-1.5 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Particles Switch */}
                  <div className="flex items-center justify-between border-t border-line/40 pt-3">
                    <div>
                      <span className="font-semibold text-ink">悬浮光斑与水雾粒子</span>
                      <p className="text-[11px] text-ink-soft">风场微光粒子仿真</p>
                    </div>
                    <SwitchToggle checked={lighting.particlesEnabled} onCheckedChange={(particlesEnabled) => onChangeLighting((prev) => ({ ...prev, particlesEnabled }))} />
                  </div>

                  <Button size="sm" variant="default" onClick={handleResetLighting} className="mt-2 w-full gap-1.5 text-xs">
                    <LuRotateCcw className="size-3.5" />
                    <span>重置光效参数</span>
                  </Button>
                </div>
              )}

              {/* TAB 3: SEASONS & SCHEDULING */}
              {inspectorTab === 'seasons' && (
                <div className="flex flex-col gap-3">
                  <span className="font-semibold text-ink">四季节庆预设主题</span>
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
                      <span className="font-semibold text-ink">当前调度规则</span>
                      <span className="font-mono text-[11px] text-accent">{activeSeason.scheduleRule}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-soft leading-relaxed">{activeSeason.subtitle}</p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
