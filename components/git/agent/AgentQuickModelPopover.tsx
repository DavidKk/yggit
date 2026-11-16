'use client'

import { Popover } from '@base-ui/react/popover'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import { LuBot, LuSettings, LuShieldAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Select, type SelectOption, Tooltip } from '@/components/sk'
import { dropdownPopupClass } from '@/components/sk/dropdownMenu'
import { useAgent } from '@/lib/agent/agent-context'
import { isModelAllowed } from '@/lib/agent/model-filter'
import { AGENT_PRESETS } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

interface Props {
  tabIndex?: number
  className?: string
}

export function AgentQuickModelPopover({ tabIndex, className }: Props) {
  const t = useT()
  const { profiles, activeProfileId, selectProfile, saveProfile, modelFilter } = useAgent()
  const [open, setOpen] = useState(false)

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0]

  // Build platform options: ONLY configured profiles, never unconfigured presets
  const platformOptions: SelectOption[] = useMemo(() => {
    return profiles.map((p) => {
      const preset = AGENT_PRESETS[p.config.provider]
      const label = p.name || preset?.name || p.config.provider
      return { value: p.id, label }
    })
  }, [profiles])

  // Current platform selection value (profile ID)
  const currentPlatformValue = activeProfile?.id || (platformOptions[0]?.value ?? '')

  const currentPreset = activeProfile ? AGENT_PRESETS[activeProfile.config.provider] : undefined

  // Build model options for currently selected platform: filter out blacklisted models
  const modelOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = []
    if (currentPreset?.models) {
      for (const m of currentPreset.models) {
        if (isModelAllowed(m.id, modelFilter)) {
          list.push({ value: m.id, label: m.name })
        }
      }
    }
    // If active model is a custom string not in preset list, include it only if allowed
    if (activeProfile?.config.model && !list.some((item) => item.value === activeProfile.config.model) && isModelAllowed(activeProfile.config.model, modelFilter)) {
      list.unshift({
        value: activeProfile.config.model,
        label: `${activeProfile.config.model} (自定义)`,
      })
    }
    return list
  }, [currentPreset, activeProfile, modelFilter])

  const handlePlatformChange = (value: string) => {
    selectProfile(value)
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

  const isCurrentModelBlocked = !isModelAllowed(activeProfile?.config.model || '', modelFilter)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        // Prevent closing when clicking inside the Select dropdown floating panel
        if (!nextOpen && eventDetails?.event) {
          const target = eventDetails.event.target as Element | null
          if (target?.closest?.('[data-listbox-panel]')) {
            eventDetails.cancel()
            return
          }
        }
        setOpen(nextOpen)
      }}
    >
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
            className={cn(dropdownPopupClass, 'w-64 max-w-[calc(100vw-2rem)] flex flex-col gap-2.5 p-3 text-xs shadow-xl animate-in fade-in zoom-in-95 duration-150 select-none')}
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
              <span className="text-[11px] font-medium text-ink-soft" id="agent-platform-label">
                {t('gitAgent.modelProvider')}
              </span>
              <Select aria-label={t('gitAgent.modelProvider')} className="w-full" value={currentPlatformValue} options={platformOptions} onChange={handlePlatformChange} />
            </div>

            {/* Dropdown 2: Model Selection */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-soft" id="agent-model-label">
                {t('gitAgent.modelName')}
              </span>
              <Select aria-label={t('gitAgent.modelName')} className="w-full" value={activeProfile?.config.model || ''} options={modelOptions} onChange={handleModelChange} />
            </div>

            {/* Blocked model alert */}
            {isCurrentModelBlocked && (
              <div className="flex items-center gap-1.5 rounded border border-fail/30 bg-fail/10 p-2 text-[11px] text-fail font-medium">
                <LuShieldAlert className="size-3.5 shrink-0" />
                <span>{t('gitAgent.modelBlockedNotice')}</span>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
