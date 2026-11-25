'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { LuCheck, LuDownload, LuTriangleAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { type InputSuggestionAction, type InputSuggestionProgress, Spinner } from '@/components/sk'
import { type BrowserAiStatus, ensureBrowserAiSession, getBrowserAiAvailability } from '@/lib/agent/browser-ai'
import { useBrowserAiDebugOverride } from '@/lib/agent/browser-ai-debug'
import { type BrowserLocalPhase, ensureBrowserLocalModel } from '@/lib/agent/browser-local'
import { getLocalModelSpec, inspectLocalModelCache, type LocalModelCacheInfo } from '@/lib/agent/local-models'
import type { AgentProviderType } from '@/lib/agent/types'

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

  useEffect(() => {
    if (provider === 'browser-local') {
      setHasWebGpu(typeof navigator !== 'undefined' && 'gpu' in navigator)
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
    const isBusy = aiInstalling || aiStatus === 'downloading' || aiStatus === 'preparing'
    let action: InputSuggestionAction
    let warn: string | undefined

    if (aiChecking) {
      action = { icon: <Spinner className="size-3.5" />, statusOnly: true }
    } else if (aiStatus === 'available') {
      action = {
        icon: <LuCheck className="size-3.5" />,
        label: t('gitAgent.browserAiStatusAvailable') || '已安装就绪',
        tone: 'ok',
        statusOnly: true,
      }
    } else if (aiStatus === 'downloading') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: `${aiPercent ?? 0}%`,
        tone: 'accent',
        statusOnly: true,
      }
    } else if (aiStatus === 'preparing') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: t('gitAgent.browserAiStatusPreparing') || '解压加载中…',
        tone: 'accent',
        statusOnly: true,
      }
    } else if (aiStatus === 'downloadable') {
      action = {
        icon: <LuDownload className="size-3.5" />,
        label: t('gitAgent.browserAiInstallBtn') || '安装并启用',
        title: t('gitAgent.browserAiInstallBtn') || '安装并启用 Browser AI',
        tone: 'accent',
        disabled: isBusy,
        onClick: handleInstallBrowserAi,
      }
    } else {
      const label = aiStatus === 'unavailable' ? t('gitAgent.browserAiStatusUnavailable') || '设备不可用' : t('gitAgent.browserAiStatusUnsupported') || '浏览器不支持'
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
      description: t('gitAgent.browserAiSharedNote') || '跨站点共享缓存，已下载过可直接使用。',
      action,
      warn,
      progress: {
        active: aiStatus === 'downloading' || aiStatus === 'preparing',
        percent: aiPercent,
        indeterminate: aiStatus === 'preparing',
      },
    }
  }

  if (provider === 'browser-local') {
    const isCached = cacheInfo.fileCount > 0
    const isBusy = localPhase === 'downloading' || localPhase === 'preparing'
    const runtimeLabel = hasWebGpu ? t('gitAgent.browserLocalRuntimeWebGpu') || 'WebGPU' : t('gitAgent.browserLocalRuntimeWasm') || 'WASM'
    const baseDesc = t('gitAgent.browserLocalDesc') || '本地离线模型（WebGPU / WASM），权重缓存在当前站点浏览器缓存中。'
    const cacheDesc = isCached
      ? (t('gitAgent.browserLocalCacheInfo') || '当前源缓存：{count} 个分片 · {size}')
          .replace('{count}', String(cacheInfo.fileCount))
          .replace('{size}', cacheInfo.bytes > 0 ? formatBytes(cacheInfo.bytes) : `~${formatBytes(localSpec.estimatedBytes)}`)
      : ''

    let action: InputSuggestionAction
    if (localChecking) {
      action = { icon: <Spinner className="size-3.5" />, statusOnly: true }
    } else if (localPhase === 'downloading') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: `${localPercent ?? 0}%`,
        tone: 'accent',
        statusOnly: true,
      }
    } else if (localPhase === 'preparing') {
      action = {
        icon: <Spinner className="size-3.5" />,
        label: t('gitAgent.browserLocalStatusLoading') || '加载中…',
        tone: 'accent',
        statusOnly: true,
      }
    } else if (localPhase === 'ready' || isCached) {
      action = {
        icon: <LuCheck className="size-3.5" />,
        label: t('gitAgent.browserLocalStatusCached') || '已缓存就绪',
        tone: 'ok',
        statusOnly: true,
      }
    } else if (localPhase === 'failed') {
      action = {
        icon: <LuDownload className="size-3.5" />,
        label: t('gitAgent.retry') || '重试',
        title: t('gitAgent.browserLocalDownloadBtnShort') || '下载',
        tone: 'warn',
        onClick: handleDownloadLocal,
      }
    } else {
      action = {
        icon: <LuDownload className="size-3.5" />,
        label: t('gitAgent.browserLocalDownloadBtnShort') || '下载',
        title: t('gitAgent.browserLocalDownloadBtnShort') || '下载',
        tone: 'accent',
        onClick: handleDownloadLocal,
      }
    }

    return {
      readOnly: true,
      hideDropdown: isBusy,
      description: cacheDesc ? `${baseDesc} ${cacheDesc}` : baseDesc,
      runtimeBadge: {
        label: runtimeLabel,
        isWebGpu: hasWebGpu,
      },
      action,
      progress: {
        active: isBusy,
        percent: localPercent,
        indeterminate: localPhase === 'preparing',
      },
    }
  }

  return null
}
