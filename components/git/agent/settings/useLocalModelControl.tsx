'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuCheck, LuDownload, LuTriangleAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { type InputSuggestionAction, type InputSuggestionProgress, Spinner } from '@/components/sk'
import { type BrowserAiStatus, ensureBrowserAiSession, getBrowserAiAvailability } from '@/lib/agent/browser-ai'
import { useBrowserAiDebugOverride } from '@/lib/agent/browser-ai-debug'
import { type BrowserLocalPhase, ensureBrowserLocalModel } from '@/lib/agent/browser-local'
import { getLocalModelSpec, inspectLocalModelCache, isLocalModelMarkedReady, type LocalModelCacheInfo } from '@/lib/agent/local-models'
import type { AgentProviderType } from '@/lib/agent/types'
import { useBrowserDownloads } from '@/lib/downloads/browser-downloads'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value >= 100 || idx === 0 ? Math.round(value) : value.toFixed(1)} ${units[idx]}`
}

export interface UnifiedLocalModelControl {
  readOnly: boolean
  hideDropdown: boolean
  isReady: boolean
  description: string
  runtimeBadge?: { label: string; isWebGpu: boolean }
  action?: InputSuggestionAction
  progress?: InputSuggestionProgress
  warn?: string
}

/**
 * Unifies Browser AI (Chrome Gemini Nano) and Browser Local AI (WebGPU / WASM)
 * into a single Default Model InputSuggestion control state.
 */
export function useLocalModelControl({
  provider,
  modelId,
  browserAiRefreshSignal = 0,
  localCacheRevision = 0,
}: {
  provider: AgentProviderType
  modelId: string
  browserAiRefreshSignal?: number
  localCacheRevision?: number
}): UnifiedLocalModelControl | null {
  const t = useT()
  const notify = useNotification()
  const debugOverride = useBrowserAiDebugOverride()
  const downloads = useBrowserDownloads()

  // Browser AI state
  const [aiStatus, setAiStatus] = useState<BrowserAiStatus>('unsupported')
  const [aiPercent, setAiPercent] = useState<number | undefined>(undefined)
  const [aiChecking, setAiChecking] = useState(false)
  const [aiInstalling, setAiInstalling] = useState(false)

  // Browser Local AI state
  const localSpec = getLocalModelSpec(modelId)
  const [hasWebGpu, setHasWebGpu] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<LocalModelCacheInfo>({ supported: true, fileCount: 0, bytes: 0 })
  const [localChecking, setLocalChecking] = useState(false)
  const [localPhase, setLocalPhase] = useState<BrowserLocalPhase>('idle')
  const [localPercent, setLocalPercent] = useState<number | undefined>(undefined)

  const activeAiDownload = downloads.find((d) => d.status === 'running' && d.kind === 'browser-ai')
  const activeLocalDownload = downloads.find((d) => d.status === 'running' && d.id === `browser-local:${localSpec.id}`)

  const effectiveAiStatus: BrowserAiStatus = activeAiDownload ? (activeAiDownload.phase === 'prepare' ? 'preparing' : 'downloading') : aiStatus
  const effectiveAiPercent = activeAiDownload ? activeAiDownload.percent : aiPercent
  const effectiveLocalPhase: BrowserLocalPhase = activeLocalDownload ? (activeLocalDownload.phase === 'prepare' ? 'preparing' : 'downloading') : localPhase
  const effectiveLocalPercent = activeLocalDownload ? activeLocalDownload.percent : localPercent

  const refreshBrowserAi = useCallback(async () => {
    setAiChecking(true)
    try {
      const result = await getBrowserAiAvailability()
      setAiStatus(result.status)
      setAiPercent(result.percent)
    } finally {
      setAiChecking(false)
    }
  }, [])

  const refreshLocalCache = useCallback(async () => {
    setLocalChecking(true)
    try {
      const info = await inspectLocalModelCache(localSpec.repository)
      setCacheInfo(info)
    } finally {
      setLocalChecking(false)
    }
  }, [localSpec.repository])

  useEffect(() => {
    if (provider === 'browser-ai') {
      void refreshBrowserAi()
    }
  }, [provider, refreshBrowserAi, browserAiRefreshSignal, debugOverride])

  const wasLocalDownloadingRef = useRef(false)
  useEffect(() => {
    const isRunning = Boolean(activeLocalDownload)
    if (wasLocalDownloadingRef.current && !isRunning && provider === 'browser-local') {
      void refreshLocalCache()
    }
    wasLocalDownloadingRef.current = isRunning
  }, [activeLocalDownload, provider, refreshLocalCache])

  useEffect(() => {
    if (provider === 'browser-local') {
      setHasWebGpu(typeof navigator !== 'undefined' && 'gpu' in navigator)
      setLocalPhase('idle')
      setLocalPercent(undefined)
      void refreshLocalCache()
    }
  }, [provider, refreshLocalCache, localCacheRevision])

  const handleInstallBrowserAi = useCallback(async () => {
    setAiInstalling(true)
    try {
      const session = await ensureBrowserAiSession({
        openProgressPopover: true,
        onStatusChange: (nextStatus, nextPercent) => {
          setAiStatus(nextStatus)
          setAiPercent(nextPercent)
        },
      })
      session.destroy?.()
      setAiStatus('available')
      setAiPercent(100)
      notify.success(t('gitAgent.browserAiInstallSuccess') || 'Browser AI (Gemini Nano) is ready to use.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Browser AI'
      notify.error((t('gitAgent.browserAiInstallFailed') || 'Browser AI initialization failed: {error}').replace('{error}', message))
      await refreshBrowserAi()
    } finally {
      setAiInstalling(false)
    }
  }, [notify, refreshBrowserAi, t])

  const handleDownloadLocal = useCallback(async () => {
    setLocalPhase('downloading')
    setLocalPercent(0)
    try {
      await ensureBrowserLocalModel(localSpec.id, {
        openProgressPopover: true,
        onProgress: (nextPhase, nextPercent) => {
          setLocalPhase(nextPhase)
          setLocalPercent(nextPercent)
        },
      })
      setLocalPhase('ready')
      setLocalPercent(100)
      await refreshLocalCache()
      notify.success(t('gitAgent.browserLocalDownloadSuccess') || 'Local model downloaded and ready to use.')
    } catch (err) {
      setLocalPhase('failed')
      const message = err instanceof Error ? err.message : 'Failed to load local model'
      notify.error((t('gitAgent.browserLocalDownloadFailed') || 'Failed to load local model: {error}').replace('{error}', message))
    }
  }, [localSpec.id, notify, refreshLocalCache, t])

  if (provider === 'browser-ai') {
    const isBusy = aiInstalling || effectiveAiStatus === 'downloading' || effectiveAiStatus === 'preparing'
    let action: InputSuggestionAction
    let warn: string | undefined

    if (aiChecking && !activeAiDownload) {
      action = { icon: <Spinner className="size-3.5" />, statusOnly: true }
    } else if (effectiveAiStatus === 'available') {
      action = {
        icon: <LuCheck className="size-3.5" />,
        label: t('gitAgent.browserAiStatusAvailable') || 'Installed & Ready',
        tone: 'ok',
        statusOnly: true,
      }
    } else if (effectiveAiStatus === 'downloading') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: `${effectiveAiPercent ?? 0}%`,
        tone: 'accent',
        statusOnly: true,
      }
    } else if (effectiveAiStatus === 'preparing') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: t('gitAgent.browserAiStatusPreparing') || 'Extracting & Loading…',
        tone: 'accent',
        statusOnly: true,
      }
    } else if (effectiveAiStatus === 'downloadable') {
      action = {
        icon: <LuDownload className="size-3.5" />,
        label: t('gitAgent.browserAiInstallBtn') || 'Install & Enable',
        title: t('gitAgent.browserAiInstallBtn') || 'Install & Enable Browser AI',
        tone: 'accent',
        disabled: isBusy,
        onClick: handleInstallBrowserAi,
      }
    } else {
      const label =
        effectiveAiStatus === 'unavailable' ? t('gitAgent.browserAiStatusUnavailable') || 'Device Unavailable' : t('gitAgent.browserAiStatusUnsupported') || 'Browser Unsupported'
      action = {
        icon: <LuTriangleAlert className="size-3.5" />,
        label,
        tone: 'warn',
        statusOnly: true,
      }
      warn = label
    }

    return {
      readOnly: true,
      hideDropdown: true,
      isReady: !aiChecking && !isBusy && effectiveAiStatus === 'available',
      description: t('gitAgent.browserAiSharedNote') || 'Shared cache across sites; ready to use if already downloaded.',
      action,
      warn,
      progress: {
        active: effectiveAiStatus === 'downloading' || effectiveAiStatus === 'preparing',
        percent: effectiveAiPercent,
        indeterminate: effectiveAiStatus === 'preparing',
      },
    }
  }

  if (provider === 'browser-local') {
    const isCached = cacheInfo.fileCount > 0
    const isCacheComplete = isCached && (isLocalModelMarkedReady(localSpec.id) || cacheInfo.bytes >= localSpec.estimatedBytes * 0.75)
    const isBusy = effectiveLocalPhase === 'downloading' || effectiveLocalPhase === 'preparing'
    const runtimeLabel = hasWebGpu ? t('gitAgent.browserLocalRuntimeWebGpu') || 'WebGPU' : t('gitAgent.browserLocalRuntimeWasm') || 'WASM'
    const baseDesc = t('gitAgent.browserLocalDesc') || 'Local offline model (WebGPU / WASM); weights are cached in this browser origin.'
    const cacheDesc = isCached
      ? (t('gitAgent.browserLocalCacheInfo') || 'Origin cache: {count} shards · {size}')
          .replace('{count}', String(cacheInfo.fileCount))
          .replace('{size}', cacheInfo.bytes > 0 ? formatBytes(cacheInfo.bytes) : `~${formatBytes(localSpec.estimatedBytes)}`)
      : ''

    let action: InputSuggestionAction
    if (localChecking && !isBusy) {
      action = { icon: <Spinner className="size-3.5" />, statusOnly: true }
    } else if (effectiveLocalPhase === 'downloading') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: `${effectiveLocalPercent ?? 0}%`,
        tone: 'accent',
        statusOnly: true,
      }
    } else if (effectiveLocalPhase === 'preparing') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: t('gitAgent.browserLocalStatusLoading') || 'Loading…',
        tone: 'accent',
        statusOnly: true,
      }
    } else if (!isBusy && (effectiveLocalPhase === 'ready' || isCacheComplete)) {
      action = {
        icon: <LuCheck className="size-3.5" />,
        label: t('gitAgent.browserLocalStatusCached') || 'Ready',
        tone: 'ok',
        statusOnly: true,
      }
    } else if (effectiveLocalPhase === 'failed') {
      action = {
        icon: <LuDownload className="size-3.5" />,
        label: t('gitAgent.retry') || 'Retry',
        title: t('gitAgent.browserLocalDownloadBtnShort') || 'Download',
        tone: 'warn',
        onClick: handleDownloadLocal,
      }
    } else {
      action = {
        icon: <LuDownload className="size-3.5" />,
        label: t('gitAgent.browserLocalDownloadBtnShort') || 'Download',
        title: t('gitAgent.browserLocalDownloadBtnShort') || 'Download',
        tone: 'accent',
        onClick: handleDownloadLocal,
      }
    }

    return {
      readOnly: true,
      hideDropdown: isBusy,
      isReady: !isBusy && !localChecking && (effectiveLocalPhase === 'ready' || isCacheComplete),
      description: cacheDesc ? `${baseDesc} ${cacheDesc}` : baseDesc,
      runtimeBadge: {
        label: runtimeLabel,
        isWebGpu: hasWebGpu,
      },
      action,
      progress: {
        active: isBusy,
        percent: effectiveLocalPercent,
        indeterminate: effectiveLocalPhase === 'preparing',
      },
    }
  }

  return null
}
