'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { LuCheck, LuDownload, LuTriangleAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, Spinner } from '@/components/sk'
import { type BrowserAiStatus, ensureBrowserAiSession, getBrowserAiAvailability } from '@/lib/agent/browser-ai'
import { useBrowserAiDebugOverride } from '@/lib/agent/browser-ai-debug'

/**
 * Compact status & installation row for Chrome Built-in AI (Gemini Nano / Prompt API).
 * Only triggers download if the shared browser model is not yet installed.
 */
export function BrowserAiChannelCard({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const t = useT()
  const notify = useNotification()
  const debugOverride = useBrowserAiDebugOverride()
  const [status, setStatus] = useState<BrowserAiStatus>('unsupported')
  const [percent, setPercent] = useState<number | undefined>(undefined)
  const [checking, setChecking] = useState(true)
  const [installing, setInstalling] = useState(false)

  const refreshStatus = useCallback(async () => {
    setChecking(true)
    try {
      const result = await getBrowserAiAvailability()
      setStatus(result.status)
      setPercent(result.percent)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus, refreshSignal, debugOverride])

  const handleInstall = async () => {
    setInstalling(true)
    try {
      const session = await ensureBrowserAiSession({
        openProgressPopover: true,
        onStatusChange: (nextStatus, nextPercent) => {
          setStatus(nextStatus)
          setPercent(nextPercent)
        },
      })
      session.destroy?.()
      setStatus('available')
      setPercent(100)
      notify.success(t('gitAgent.browserAiInstallSuccess') || 'Browser AI (Gemini Nano) is ready to use.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Browser AI'
      notify.error((t('gitAgent.browserAiInstallFailed') || 'Browser AI initialization failed: {error}').replace('{error}', message))
      await refreshStatus()
    } finally {
      setInstalling(false)
    }
  }

  const renderBadge = () => {
    if (checking) {
      return (
        <Badge tone="neutral" size="mini" dot={false}>
          <Spinner className="size-3" />
        </Badge>
      )
    }
    switch (status) {
      case 'available':
        return (
          <Badge tone="ok" size="md" dot={false} className="h-6 px-2.5 text-xs">
            <LuCheck className="size-3.5" aria-hidden="true" />
            {t('gitAgent.browserAiStatusAvailable') || '已安装就绪'}
          </Badge>
        )
      case 'downloadable':
        return null
      case 'downloading':
        return (
          <Badge tone="accent" size="md" dot={false}>
            {(t('gitAgent.browserAiStatusDownloading') || '下载中 {percent}%').replace('{percent}', String(percent ?? 0))}
          </Badge>
        )
      case 'preparing':
        return (
          <Badge tone="accent" size="md" dot={false}>
            {t('gitAgent.browserAiStatusPreparing') || '解压加载中…'}
          </Badge>
        )
      case 'unavailable':
        return (
          <Badge tone="warn" size="md" dot={false}>
            <LuTriangleAlert className="size-3.5" aria-hidden="true" />
            {t('gitAgent.browserAiStatusUnavailable') || '设备不可用'}
          </Badge>
        )
      case 'unsupported':
      default:
        return (
          <Badge tone="warn" size="md" dot={false}>
            <LuTriangleAlert className="size-3.5" aria-hidden="true" />
            {t('gitAgent.browserAiStatusUnsupported') || '浏览器不支持'}
          </Badge>
        )
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
      <div className="md:col-span-5 min-w-0">
        <p className="text-xs text-ink-soft leading-relaxed">
          {t('gitAgent.browserAiSharedNote') || '模型由 Chrome 跨站点共享缓存。若已在其他网站下载过，则无需重复安装，可直接使用。'}
        </p>
      </div>

      <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {renderBadge()}
          {(status === 'downloadable' || status === 'downloading' || status === 'preparing') && (
            <Button type="button" variant="accent" size="sm" disabled={installing || status === 'downloading' || status === 'preparing'} onClick={() => void handleInstall()}>
              {installing || status === 'downloading' || status === 'preparing' ? <Spinner className="size-3.5" /> : <LuDownload className="size-3.5" aria-hidden="true" />}
              {t('gitAgent.browserAiInstallBtn') || '安装并启用 Browser AI'}
            </Button>
          )}
        </div>

        {(status === 'downloading' || status === 'preparing') && (
          <div className="flex flex-col gap-1">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={status === 'preparing' ? undefined : percent}
              className="h-1.5 overflow-hidden rounded-full bg-inset"
            >
              {status === 'preparing' ? (
                <div className="h-full w-full animate-pulse rounded-full bg-accent/60" />
              ) : (
                <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${percent ?? 0}%` }} />
              )}
            </div>
            <span className="text-[11px] text-ink-soft tabular-nums text-right">
              {status === 'preparing'
                ? t('gitAgent.browserAiStatusPreparing') || '正在解压并加载至内存…'
                : `${percent ?? 0}% · ${t('gitAgent.browserAiDownloadingHint') || '右上角可实时查看下载进度'}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
