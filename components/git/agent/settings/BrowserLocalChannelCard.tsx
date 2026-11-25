'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { LuCheck, LuCpu, LuDownload, LuTriangleAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, Spinner } from '@/components/sk'
import { type BrowserLocalPhase, ensureBrowserLocalModel } from '@/lib/agent/browser-local'
import { getLocalModelSpec, inspectLocalModelCache, type LocalModelCacheInfo } from '@/lib/agent/local-models'

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

/**
 * Status, WebGPU/WASM capability, and download control row for Browser Local AI models.
 */
export function BrowserLocalChannelCard({ modelId, cacheRevision = 0 }: { modelId: string; cacheRevision?: number }) {
  const t = useT()
  const notify = useNotification()
  const spec = getLocalModelSpec(modelId)

  const [hasWebGpu, setHasWebGpu] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<LocalModelCacheInfo>({ supported: true, fileCount: 0, bytes: 0 })
  const [checking, setChecking] = useState(true)
  const [phase, setPhase] = useState<BrowserLocalPhase>('idle')
  const [percent, setPercent] = useState<number | undefined>(undefined)

  const refreshCache = useCallback(async () => {
    setChecking(true)
    try {
      const info = await inspectLocalModelCache(spec.repository)
      setCacheInfo(info)
    } finally {
      setChecking(false)
    }
  }, [spec.repository])

  useEffect(() => {
    setHasWebGpu(typeof navigator !== 'undefined' && 'gpu' in navigator)
    void refreshCache()
  }, [refreshCache, cacheRevision])

  const handleDownload = async () => {
    setPhase('downloading')
    setPercent(0)
    try {
      await ensureBrowserLocalModel(spec.id, {
        openProgressPopover: true,
        onProgress: (nextPhase, nextPercent) => {
          setPhase(nextPhase)
          setPercent(nextPercent)
        },
      })
      setPhase('ready')
      setPercent(100)
      await refreshCache()
      notify.success(t('gitAgent.browserLocalDownloadSuccess') || 'Local model downloaded and ready to use.')
    } catch (err) {
      setPhase('failed')
      const message = err instanceof Error ? err.message : 'Failed to load local model'
      notify.error((t('gitAgent.browserLocalDownloadFailed') || 'Failed to load local model: {error}').replace('{error}', message))
    }
  }

  const isCached = cacheInfo.fileCount > 0
  const isBusy = phase === 'downloading' || phase === 'preparing'

  const renderStatusBadge = () => {
    if (checking) {
      return (
        <Badge tone="neutral" size="mini" dot={false}>
          <Spinner className="size-3" />
        </Badge>
      )
    }
    if (phase === 'downloading') {
      return (
        <Badge tone="accent" size="md" dot={false}>
          {(t('gitAgent.browserLocalStatusDownloading') || '下载中 {percent}%').replace('{percent}', String(percent ?? 0))}
        </Badge>
      )
    }
    if (phase === 'preparing') {
      return (
        <Badge tone="accent" size="md" dot={false}>
          {t('gitAgent.browserLocalStatusLoading') || '正在加载模型…'}
        </Badge>
      )
    }
    if (phase === 'failed') {
      return (
        <Badge tone="warn" size="md" dot={false}>
          <LuTriangleAlert className="size-3.5" aria-hidden="true" />
          {t('gitAgent.browserLocalStatusError') || '加载失败'}
        </Badge>
      )
    }
    if (phase === 'ready' || isCached) {
      return (
        <Badge tone="ok" size="md" dot={false} className="h-6 px-2.5 text-xs">
          <LuCheck className="size-3.5" aria-hidden="true" />
          {t('gitAgent.browserLocalStatusCached') || '已缓存就绪'}
        </Badge>
      )
    }
    return (
      <Badge tone="neutral" size="md" dot={false}>
        {t('gitAgent.browserLocalStatusNotCached') || '未下载'}
      </Badge>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
      <div className="md:col-span-5 min-w-0 flex flex-col gap-1">
        <p className="text-xs text-ink-soft leading-relaxed">{t('gitAgent.browserLocalDesc') || '本地离线模型（WebGPU / WASM），权重缓存在当前站点浏览器缓存中。'}</p>
        {isCached && (
          <span className="text-[11px] text-ink-soft tabular-nums">
            {(t('gitAgent.browserLocalCacheInfo') || '当前源缓存：{count} 个分片 · {size}')
              .replace('{count}', String(cacheInfo.fileCount))
              .replace('{size}', cacheInfo.bytes > 0 ? formatBytes(cacheInfo.bytes) : `~${formatBytes(spec.estimatedBytes)}`)}
          </span>
        )}
      </div>

      <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge tone={hasWebGpu ? 'accent' : 'neutral'} size="md" dot={false}>
            <LuCpu className="size-3.5" aria-hidden="true" />
            {hasWebGpu ? t('gitAgent.browserLocalRuntimeWebGpu') || 'WebGPU 加速' : t('gitAgent.browserLocalRuntimeWasm') || 'WASM 运行时'}
          </Badge>
          {renderStatusBadge()}
          {!isCached && (
            <Button type="button" variant="accent" size="sm" disabled={isBusy || checking} onClick={() => void handleDownload()}>
              {isBusy ? <Spinner className="size-3.5" /> : <LuDownload className="size-3.5" aria-hidden="true" />}
              {t('gitAgent.browserLocalDownloadBtnShort') || '下载'}
            </Button>
          )}
        </div>

        {isBusy && (
          <div className="flex flex-col gap-1">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={phase === 'preparing' ? undefined : percent}
              className="h-1.5 overflow-hidden rounded-full bg-inset"
            >
              {phase === 'preparing' ? (
                <div className="h-full w-full animate-pulse rounded-full bg-accent/60" />
              ) : (
                <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${percent ?? 0}%` }} />
              )}
            </div>
            <span className="text-[11px] text-ink-soft tabular-nums text-right">
              {phase === 'preparing'
                ? t('gitAgent.browserLocalStatusLoading') || '正在加载模型…'
                : `${percent ?? 0}% · ${t('gitAgent.browserLocalDownloadingHint') || '右上角可实时查看下载进度'}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
