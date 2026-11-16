'use client'

import { Popover } from '@base-ui/react/popover'
import Link from 'next/link'
import React, { useState } from 'react'
import { LuArrowRight, LuBot, LuCheck, LuExternalLink, LuSettings } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { dropdownPopupClass } from '@/components/sk/dropdownMenu'
import { useAgent } from '@/lib/agent/agent-context'
import { AGENT_PRESETS } from '@/lib/agent/types'
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
  const activePreset = activeProfile ? AGENT_PRESETS[activeProfile.config.provider] : undefined

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
            className={cn(dropdownPopupClass, 'w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2 p-2.5 text-xs shadow-xl animate-in fade-in zoom-in-95 duration-150 select-none')}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-line/60">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <LuBot className="size-3.5 text-accent" />
                <span>{t('gitAgent.quickModelPopoverTitle')}</span>
              </div>
              <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-1 text-[11px] text-accent hover:underline hover:brightness-110">
                <span>{t('gitAgent.settingsPage')}</span>
                <LuExternalLink className="size-3" />
              </Link>
            </div>

            {/* Platform / Profile Switcher */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-medium text-ink-soft">{t('gitAgent.channelProfile')}</div>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-0.5">
                {profiles.map((p) => {
                  const isActive = p.id === activeProfileId
                  const preset = AGENT_PRESETS[p.config.provider]
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProfile(p.id)}
                      className={cn(
                        'flex items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer',
                        isActive ? 'bg-accent/15 text-accent border border-accent/30 font-medium' : 'hover:bg-[var(--overlay-06)] text-ink border border-transparent'
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-1">
                        <span className="truncate text-xs">{p.name}</span>
                        <span className="text-[10px] text-ink-soft truncate">
                          {preset?.name || p.config.provider} · {p.config.model}
                        </span>
                      </div>
                      {isActive && <LuCheck className="size-3.5 shrink-0 text-accent" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Fast Model Switcher (for active profile) */}
            {activePreset?.models && activePreset.models.length > 0 && (
              <div className="border-t border-line/60 pt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-ink-soft">
                  <span className="font-medium">{t('gitAgent.quickSwitchModel')}</span>
                  <span className="text-[10px] font-mono opacity-80 truncate max-w-[120px]">{activeProfile?.config.model}</span>
                </div>
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5">
                  {activePreset.models.map((m) => {
                    const isModelActive = activeProfile?.config.model === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (activeProfile) {
                            saveProfile({
                              ...activeProfile,
                              config: {
                                ...activeProfile.config,
                                model: m.id,
                              },
                            })
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors cursor-pointer',
                          isModelActive ? 'bg-accent text-accent-ink font-medium shadow-2xs' : 'hover:bg-[var(--overlay-06)] text-ink'
                        )}
                      >
                        <span className="truncate">{m.name}</span>
                        {isModelActive ? (
                          <LuCheck className="size-3 shrink-0 ml-1 text-accent-ink" />
                        ) : (
                          <span className="text-[10px] font-mono text-ink-soft shrink-0 ml-1">{m.id}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer Settings Link */}
            <div className="border-t border-line/60 pt-1.5">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink transition-colors"
              >
                <span>{t('gitAgent.manageSettingsLink')}</span>
                <LuArrowRight className="size-3" />
              </Link>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
