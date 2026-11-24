'use client'

import React from 'react'
import { LuRotateCcw, LuSlidersHorizontal, LuSparkles, LuSun, LuWind } from 'react-icons/lu'

import { SettingsSectionCard } from '@/components/git/agent/settings/SettingsSectionCard'
import { Badge, Button } from '@/components/sk'
import { SwitchToggle } from '@/components/sk/Switch'

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

export function StudioEditorSection({ wind, onChangeWind, lighting, onChangeLighting, timePresetId, onSelectTimePreset, seasonId, onChangeSeason }: StudioEditorSectionProps) {
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
    <div className="flex flex-col gap-6">
      {/* 1. Real-time Canvas Stage Preview */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuSparkles className="size-4 text-accent" />
            <span>实时 60 FPS 动效舞台</span>
          </div>
        }
        description="基于 WebGL + 2D Canvas 双层渲染，实时联动右侧风场物理动力学与微环境光影参数"
        titleAction={
          <div className="flex items-center gap-2">
            <Badge tone="accent">60 FPS 物理模拟</Badge>
            <Badge tone="neutral">1672 × 941 Canvas</Badge>
          </div>
        }
      >
        <div className="overflow-hidden rounded-xl border border-line bg-[#03090d] shadow-sm">
          <YggitOfficialPreview
            view="p1-p4-studio"
            seasonId={seasonId}
            onChangeSeason={onChangeSeason}
            timePresetId={timePresetId}
            onSelectTimePreset={onSelectTimePreset}
            wind={wind}
            onChangeWind={onChangeWind}
            lighting={lighting}
          />
        </div>
      </SettingsSectionCard>

      {/* 2. Grid of Parameter Control Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card A: Wind Dynamics Controls */}
        <SettingsSectionCard
          title={
            <div className="flex items-center gap-2">
              <LuWind className="size-4 text-accent" />
              <span>风场物理动力学配置</span>
            </div>
          }
          description="控制树冠叶尖、垂挂细枝与近景花草的摆动强度与周期性阵风波动"
          titleAction={
            <Button size="sm" variant="default" onClick={handleResetWind} className="gap-1.5 text-xs">
              <LuRotateCcw className="size-3.5" />
              <span>重置风场</span>
            </Button>
          }
        >
          <div className="flex flex-col gap-4 text-xs">
            {/* Switch 1: Wind Enabled */}
            <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-3">
              <div>
                <span className="font-semibold text-ink">激活物理风场仿真</span>
                <p className="text-[11px] text-ink-soft">驱动顶点网格变形器，实时计算外缘树叶与近景花草摆动</p>
              </div>
              <SwitchToggle checked={wind.enabled} onCheckedChange={(enabled) => onChangeWind((prev) => ({ ...prev, enabled }))} />
            </div>

            {/* Range 1: Strength */}
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

            {/* Range 2: Direction */}
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

            {/* Range 3: Gustiness */}
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

            {/* Debug Switches */}
            <div className="grid grid-cols-2 gap-3 border-t border-line/40 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-soft">网格线框 (Wireframe)</span>
                <SwitchToggle size="sm" checked={wind.showMeshWireframe} onCheckedChange={(showMeshWireframe) => onChangeWind((prev) => ({ ...prev, showMeshWireframe }))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-soft">锚点标定 (Anchors)</span>
                <SwitchToggle size="sm" checked={wind.showAnchors} onCheckedChange={(showAnchors) => onChangeWind((prev) => ({ ...prev, showAnchors }))} />
              </div>
            </div>
          </div>
        </SettingsSectionCard>

        {/* Card B: Lighting & Micro-environment Controls */}
        <SettingsSectionCard
          title={
            <div className="flex items-center gap-2">
              <LuSun className="size-4 text-accent" />
              <span>微环境光照与荧光渲染</span>
            </div>
          }
          description="调节昼夜天光色温、世界树发光脉冲与水雾粒子等大气微环境特效"
          titleAction={
            <Button size="sm" variant="default" onClick={handleResetLighting} className="gap-1.5 text-xs">
              <LuRotateCcw className="size-3.5" />
              <span>重置光效</span>
            </Button>
          }
        >
          <div className="flex flex-col gap-4 text-xs">
            {/* Time of Day Presets */}
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-ink">昼夜时间段预设</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIME_OF_DAY_PRESETS.map((preset) => {
                  const isSelected = preset.id === timePresetId
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectTimePreset(preset)}
                      className={`flex flex-col items-center justify-center rounded-lg border p-2 transition-all cursor-pointer ${
                        isSelected ? 'border-accent bg-accent/10 font-bold text-accent shadow-xs' : 'border-line bg-panel hover:bg-hover text-ink-soft hover:text-ink'
                      }`}
                    >
                      <span className="text-xs">{preset.name}</span>
                      <span className="text-[10px] text-ink-muted">{preset.timeRange}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Range 1: Ambient Brightness */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">环境照度 (Ambient Brightness)</span>
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

            {/* Range 2: Glow Intensity */}
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

            {/* Range 3: Fog Amount */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">山谷薄雾浓度</span>
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

            {/* Particles Toggle */}
            <div className="flex items-center justify-between gap-3 border-t border-line/40 pt-3">
              <div>
                <span className="font-semibold text-ink">悬浮光斑与水雾粒子</span>
                <p className="text-[11px] text-ink-soft">在世界树四周生成微小荧光孢子与沿风场漂浮的微光粒子</p>
              </div>
              <SwitchToggle checked={lighting.particlesEnabled} onCheckedChange={(particlesEnabled) => onChangeLighting((prev) => ({ ...prev, particlesEnabled }))} />
            </div>
          </div>
        </SettingsSectionCard>
      </div>

      {/* Card C: Season & Festival Scheduling Rules */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuSlidersHorizontal className="size-4 text-accent" />
            <span>四季与节庆主题调度规则</span>
          </div>
        }
        description="按日期区间自动切换世界树配色包与节庆微光，支持手动强制指定"
        titleAction={<Badge tone="neutral">{activeSeason.name}</Badge>}
      >
        <div className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {SEASON_THEMES.map((season) => {
              const isSelected = season.id === seasonId
              return (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => onChangeSeason(season.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 transition-all cursor-pointer ${
                    isSelected ? 'border-accent bg-accent/10 font-bold text-accent shadow-xs' : 'border-line bg-panel hover:bg-hover text-ink-soft hover:text-ink'
                  }`}
                >
                  <span className="text-xs font-semibold">{season.name}</span>
                  <span className="text-[10px] text-ink-muted line-clamp-1">{season.subtitle}</span>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-line/60 bg-panel-2/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">当前主题调度规则</span>
              <span className="font-mono text-[11px] text-accent">{activeSeason.scheduleRule}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{activeSeason.subtitle}</p>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
