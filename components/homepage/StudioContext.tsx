'use client'

import React, { createContext, useContext, useState } from 'react'

import { SeasonThemePack, TimeOfDayPreset } from './data/worldTreeData'
import { LightingConfig, WindConfig } from './LivingTreeCanvas'

interface StudioContextValue {
  wind: WindConfig
  setWind: React.Dispatch<React.SetStateAction<WindConfig>>
  lighting: LightingConfig
  setLighting: React.Dispatch<React.SetStateAction<LightingConfig>>
  seasonId: SeasonThemePack['id']
  setSeasonId: React.Dispatch<React.SetStateAction<SeasonThemePack['id']>>
  timePresetId: TimeOfDayPreset['id']
  handleSelectTimePreset: (preset: TimeOfDayPreset) => void
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: React.ReactNode }) {
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

  const [lighting, setLighting] = useState<LightingConfig>({
    ambientBrightness: 1.08,
    temperature: 0.18,
    glowIntensity: 0.92,
    nodeIntensity: 0.95,
    fogAmount: 0.12,
    particlesEnabled: true,
    weatherRainSnow: 'none',
  })

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

  return (
    <StudioContext.Provider
      value={{
        wind,
        setWind,
        lighting,
        setLighting,
        seasonId,
        setSeasonId,
        timePresetId,
        handleSelectTimePreset,
      }}
    >
      {children}
    </StudioContext.Provider>
  )
}

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider')
  return ctx
}
