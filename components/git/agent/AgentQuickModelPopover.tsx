'use client'

import { Popover } from '@base-ui/react/popover'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import { IoChevronDown } from 'react-icons/io5'
import { LuBot, LuSettings } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { dropdownPopupClass } from '@/components/sk/dropdownMenu'
import { useAgent } from '@/lib/agent/agent-context'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { AGENT_PRESETS, type AgentProviderType } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

interface Props {
  tabIndex?: number
  className?: string
}

export function AgentQuickModelPopover({ tabIndex, className }: Props) {
  const t = useT()
  const { profiles, activeProfileId, selectProfile, saveProfile } = useAgent()
  const [open, setOpen] = useState(false)

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0]

  // Build platform options: saved profiles first, then unconfigured preset providers
  const platformOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = []
    const seenProviders = new Set<string>()

    for (const p of profiles) {
      const preset = AGENT_PRESETS[p.config.provider]
      const label = p.name || preset?.name || p.config.provider
      options.push({ value: p.id, label })
      seenProviders.add(p.config.provider)
    }

    for (const key of Object.keys(AGENT_PRESETS) as AgentProviderType[]) {
      if (!seenProviders.has(key)) {
        options.push({ value: `preset:${key}`, label: AGENT_PRESETS[key].name })
      }
    }

    return options
  }, [profiles])

  // Current platform selection value (profile ID or preset key)
  const currentPlatformValue = activeProfile?.id || (platformOptions[0]?.value ?? '')

  const currentPreset = activeProfile ? AGENT_PRESETS[activeProfile.config.provider] : undefined

  // Build model options for currently selected platform
  const modelOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = []
    if (currentPreset?.models) {
      for (const m of currentPreset.models) {
        list.push({ value: m.id, label: m.name })
      }
    }
    // If active model is a custom string not in preset list, include it
    if (activeProfile?.config.model && !list.some((item) => item.value === activeProfile.config.model)) {
      list.unshift({
        value: activeProfile.config.model,
        label: `${activeProfile.config.model} (自定义)`,
      })
    }
    return list
  }, [currentPreset, activeProfile])

  const handlePlatformChange = (value: string) => {
    if (value.startsWith('preset:')) {
      const provider = value.replace('preset:', '') as AgentProviderType
      const targetPreset = AGENT_PRESETS[provider]
      const existing = profiles.find((p) => p.config.provider === provider)
      if (existing) {
        selectProfile(existing.id)
      } else {
        const newProfile: AgentModelProfile = {
          id: `profile_${provider}_${Date.now()}`,
          name: targetPreset.name,
          config: {
            provider,
            baseUrl: targetPreset.baseUrl,
            model: targetPreset.defaultModel,
          },
        }
        saveProfile(newProfile)
      }
    } else {
      selectProfile(value)
    }
  }

  const handleModelChange = (model: string) => {
    if (!activeProfile) return
    saveProfile({
      ...activeProfile,
      config: {
        ...activeProfile.config,
        model,
      },
    })
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip content={t('gitAgent.quickModelPopoverTitle')} placement="top" suppressed={open}>
        <Popover.Trigger
          type="button"
          tabIndex={tabIndex}
          aria-label={t('gitAgent.quickModelPopoverTitle')}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-ink-soft outline-none transition-all cursor-pointer',
            'hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95',
            'data-[popup-open]:bg-[var(--overlay-08)] data-[popup-open]:text-accent',
            className
          )}
        >
          <LuSettings className="size-3.5" />
        </Popover.Trigger>
      </Tooltip>

      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={8} collisionPadding={12} positionMethod="fixed" className="z-50" data-agent-popover="true">
          <Popover.Popup
            data-agent-popover="true"
            aria-label={t('gitAgent.quickModelPopoverTitle')}
            className={cn(dropdownPopupClass, 'w-60 max-w-[calc(100vw-2rem)] flex flex-col gap-2.5 p-2.5 text-xs shadow-xl animate-in fade-in zoom-in-95 duration-150 select-none')}
          >
            {/* Header: Title + Settings Icon-only link */}
            <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
              <div className="flex items-center gap-1.5 font-medium text-ink text-xs">
                <LuBot className="size-3.5 text-accent" />
                <span>{t('gitAgent.quickModelPopoverTitle')}</span>
              </div>
              <Tooltip content={t('gitAgent.settingsTitle')} placement="top">
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-06)] hover:text-accent transition-colors cursor-pointer"
                  aria-label={t('gitAgent.settingsTitle')}
                >
                  <LuSettings className="size-3.5" />
                </Link>
              </Tooltip>
            </div>

            {/* Dropdown 1: Platform Selection */}
            <div className="flex flex-col gap-1">
              <label htmlFor="agent-platform-select" className="text-[11px] font-medium text-ink-soft">
                {t('gitAgent.modelProvider')}
              </label>
              <div className="relative">
                <select
                  id="agent-platform-select"
                  value={currentPlatformValue}
                  onChange={(e) => handlePlatformChange(e.target.value)}
                  className="h-7 w-full appearance-none rounded-md border border-line bg-panel-2/90 pl-2 pr-7 text-xs text-ink outline-none transition-colors hover:border-line-hover focus:border-accent focus:ring-1 focus:ring-accent/30 cursor-pointer"
                >
                  {platformOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-panel text-ink py-1">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <IoChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-ink-soft" />
              </div>
            </div>

            {/* Dropdown 2: Model Selection */}
            <div className="flex flex-col gap-1">
              <label htmlFor="agent-model-select" className="text-[11px] font-medium text-ink-soft">
                {t('gitAgent.modelName')}
              </label>
              <div className="relative">
                <select
                  id="agent-model-select"
                  value={activeProfile?.config.model || ''}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="h-7 w-full appearance-none rounded-md border border-line bg-panel-2/90 pl-2 pr-7 text-xs text-ink outline-none transition-colors hover:border-line-hover focus:border-accent focus:ring-1 focus:ring-accent/30 cursor-pointer"
                >
                  {modelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-panel text-ink py-1">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <IoChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-ink-soft" />
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
