'use client'

import { Popover } from '@base-ui/react/popover'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { LuBot, LuSettings, LuShieldAlert, LuSlidersHorizontal } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Select, type SelectOption, Spinner, Tooltip } from '@/components/sk'
import { dropdownPopupClass } from '@/components/sk/dropdownMenu'
import { useAgent } from '@/lib/agent/agent-context'
import { isModelAllowed } from '@/lib/agent/model-filter'
import { AGENT_PRESETS } from '@/lib/agent/types'
import { useLocalProfileReadiness } from '@/lib/agent/use-local-readiness'
import { getDriverMode } from '@/lib/git/driver'
import { saveLastGitUrl } from '@/lib/git/last-git-url'
import { openEdgeSecret } from '@/lib/security/edge-vault'
import { cn } from '@/lib/utils'

interface Props {
  tabIndex?: number
  className?: string
  side?: 'top' | 'bottom'
}

export function AgentQuickModelPopover({ tabIndex, className, side = 'top' }: Props) {
  const t = useT()
  const { profiles, activeProfileId, selectProfile, saveProfile, modelFilter } = useAgent()
  const readinessMap = useLocalProfileReadiness(profiles)
  const [open, setOpen] = useState(false)
  const [remoteModelsByProfile, setRemoteModelsByProfile] = useState<Record<string, Array<{ id: string; name: string }>>>({})
  const [fetchingProfileId, setFetchingProfileId] = useState<string | null>(null)

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0]

  // Build platform options: enabled configured profiles (unready local models are shown disabled and unselectable)
  const platformOptions: SelectOption[] = useMemo(() => {
    const enabled = profiles.filter((p) => p.enabled !== false && readinessMap[p.id] !== false)
    const source = enabled.length > 0 ? enabled : profiles
    return source.map((p) => {
      const preset = AGENT_PRESETS[p.config.provider]
      const isReady = readinessMap[p.id] !== false
      const baseLabel = p.name || preset?.name || p.config.provider
      return {
        value: p.id,
        label: isReady ? baseLabel : `${baseLabel} (Not Ready)`,
        disabled: !isReady,
      }
    })
  }, [profiles, readinessMap])

  // Current platform selection value (profile ID)
  const currentPlatformValue = activeProfile?.id || (platformOptions[0]?.value ?? '')

  const currentPreset = activeProfile ? AGENT_PRESETS[activeProfile.config.provider] : undefined

  // Lazily fetch remote model list for the active API channel when popover opens
  useEffect(() => {
    if (!open || !activeProfile) return
    const provider = activeProfile.config.provider
    const preset = AGENT_PRESETS[provider]
    if (preset?.isCli || provider === 'browser-ai' || provider === 'browser-local') return
    if (remoteModelsByProfile[activeProfile.id]) return
    if (!activeProfile.config.baseUrl?.trim()) return

    let cancelled = false
    setFetchingProfileId(activeProfile.id)

    void (async () => {
      try {
        let effectiveApiKey = activeProfile.config.apiKey
        if (getDriverMode() === 'edge' && !effectiveApiKey && activeProfile.config.hasApiKey) {
          effectiveApiKey = await openEdgeSecret(activeProfile.id)
        }
        const res = await fetch('/api/git/agent/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: activeProfile.config.baseUrl,
            apiKey: effectiveApiKey,
            ...(!effectiveApiKey && activeProfile.config.hasApiKey ? { profileId: activeProfile.id } : {}),
            provider,
            modelsEndpoint: activeProfile.config.modelsEndpoint,
          }),
        })
        const data = (await res.json().catch(() => null)) as { models?: Array<{ id: string; name: string }> } | null
        if (!cancelled && res.ok && Array.isArray(data?.models) && data.models.length > 0) {
          setRemoteModelsByProfile((prev) => ({ ...prev, [activeProfile.id]: data.models! }))
        }
      } catch {
        // Fallback to preset/configured models on transient network error
      } finally {
        if (!cancelled) {
          setFetchingProfileId((curr) => (curr === activeProfile.id ? null : curr))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, activeProfile, remoteModelsByProfile])

  // Build model options for currently selected channel: remote models -> preset models -> current model
  const modelOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = []
    const seen = new Set<string>()
    const remoteModels = activeProfile ? remoteModelsByProfile[activeProfile.id] : undefined
    const sourceModels = remoteModels && remoteModels.length > 0 ? remoteModels : currentPreset?.models || []

    for (const m of sourceModels) {
      if (!seen.has(m.id) && isModelAllowed(m.id, modelFilter)) {
        seen.add(m.id)
        list.push({ value: m.id, label: m.name || m.id })
      }
    }

    // Ensure the profile's currently configured default/selected model is always selectable if allowed
    if (activeProfile?.config.model && !seen.has(activeProfile.config.model) && isModelAllowed(activeProfile.config.model, modelFilter)) {
      list.unshift({
        value: activeProfile.config.model,
        label: activeProfile.config.model,
      })
    }
    return list
  }, [activeProfile, remoteModelsByProfile, currentPreset, modelFilter])

  const handlePlatformChange = (value: string) => {
    if (readinessMap[value] === false) return
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
  const isFetchingModels = Boolean(activeProfile && fetchingProfileId === activeProfile.id)

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
      <Tooltip content={t('gitAgent.quickModelPopoverTitle')} placement={side} suppressed={open}>
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
          <LuSlidersHorizontal className="size-3.5" />
        </Popover.Trigger>
      </Tooltip>

      <Popover.Portal>
        <Popover.Positioner side={side} align="end" sideOffset={8} collisionPadding={12} positionMethod="fixed" className="z-50" data-agent-popover="true">
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
                  href="/settings/models"
                  onClick={() => {
                    setOpen(false)
                    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/git')) {
                      saveLastGitUrl(window.location.pathname + window.location.search)
                    }
                  }}
                  className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-06)] hover:text-accent transition-colors cursor-pointer"
                  aria-label={t('gitAgent.settingsTitle')}
                >
                  <LuSettings className="size-3.5" />
                </Link>
              </Tooltip>
            </div>

            {/* Dropdown 1: Channel Selection */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-soft" id="agent-platform-label">
                {t('gitAgent.modelProvider')}
              </span>
              <Select aria-label={t('gitAgent.modelProvider')} className="w-full" value={currentPlatformValue} options={platformOptions} onChange={handlePlatformChange} />
            </div>

            {/* Dropdown 2: Model Selection */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink-soft" id="agent-model-label">
                  {t('gitAgent.modelName')}
                </span>
                {isFetchingModels && <Spinner className="size-3 text-accent" />}
              </div>
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
