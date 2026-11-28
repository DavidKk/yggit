'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuCheck, LuCopy, LuFolderOpen, LuHardDrive, LuRefreshCw, LuTrash2 } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, Tooltip } from '@/components/sk'
import { maskUserHomePath } from '@/lib/format-home-path'
import { getDriverMode } from '@/lib/git/driver'
import { clearBrowserStorage, deleteBrowserDatabase, inspectBrowserStorage, type StorageSource } from '@/lib/storage/browser-storage'

import { SettingsSectionCard } from './SettingsSectionCard'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export interface StorageCategoryItem {
  name: string
  label: string
  desc: string
  path: string
  bytes: number
  clearable: boolean
}

export interface LocalStorageInfo {
  isLocal: boolean
  dataPath: string
  totalBytes: number
  items: StorageCategoryItem[]
}

export function StorageSettingsSection() {
  const t = useT()
  const notify = useNotification()
  const confirm = useConfirm()

  const [localInfo, setLocalInfo] = useState<LocalStorageInfo | null>(null)
  const [sources, setSources] = useState<StorageSource[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)

  const isEdge = getDriverMode() === 'edge'

  const refresh = useCallback(async () => {
    const current = ++generation.current
    setBusy(true)
    setError('')

    // Try fetching local filesystem storage info first when not explicitly in edge mode
    if (!isEdge) {
      try {
        const res = await fetch('/api/storage')
        if (res.ok) {
          const data = (await res.json()) as LocalStorageInfo
          if (current === generation.current && data?.isLocal) {
            setLocalInfo(data)
            setBusy(false)
            return
          }
        }
      } catch {
        // Fall back to browser storage inspection below
      }
    }

    try {
      const result = await inspectBrowserStorage()
      if (current === generation.current) {
        setLocalInfo(null)
        setSources(result)
      }
    } catch (err) {
      if (current === generation.current) setError(String(err))
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }, [isEdge])

  useEffect(() => {
    const counter = generation
    void refresh()
    return () => {
      counter.current++
    }
  }, [refresh])

  const handleCopyPath = async () => {
    if (!localInfo?.dataPath) return
    try {
      await navigator.clipboard.writeText(localInfo.dataPath)
      setCopied(true)
      notify.success(t('gitAgent.storageCopied') || 'Storage directory path copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify.error(t('gitAgent.storageCopyFailed') || 'Failed to copy path')
    }
  }

  const handleReveal = async () => {
    if (!localInfo?.dataPath) return
    try {
      const res = await fetch('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: localInfo.dataPath, reveal: false }),
      })
      if (!res.ok) {
        notify.error(t('gitAgent.storageOpenFailed') || 'Failed to open local directory')
      }
    } catch {
      notify.error(t('gitAgent.storageOpenFailed') || 'Failed to open local directory')
    }
  }

  const handleClearCache = () => {
    confirm({
      title: 'Clear Local Temporary Cache',
      description: 'Safely removes temporary Git conflict analysis and pre-flight merge cache files without affecting project indexes or credentials.',
      confirmLabel: 'Clear Cache',
      confirmVariant: 'fail',
      onConfirm: async () => {
        setBusy(true)
        try {
          const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clearCache' }),
          })
          if (res.ok) {
            notify.success(t('gitAgent.storageCacheCleared') || 'Local cache cleared successfully')
            await refresh()
          } else {
            notify.error(t('gitAgent.storageCacheClearFailed') || 'Failed to clear cache')
          }
        } catch (err) {
          notify.error(`${t('gitAgent.storageCacheClearFailed') || 'Failed to clear cache'}: ${String(err)}`)
        } finally {
          setBusy(false)
        }
      },
    })
  }

  const handleClearItem = (name: string, label: string) => {
    confirm({
      title: `Clear ${label}`,
      description: `Are you sure you want to clear cached data in ${label} (${name})?`,
      confirmLabel: 'Clear',
      confirmVariant: 'fail',
      onConfirm: async () => {
        setBusy(true)
        try {
          const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clearItem', name }),
          })
          if (res.ok) {
            notify.success(t('gitAgent.storageClearedItem', { label }) || `Cleared ${label}`)
            await refresh()
          } else {
            notify.error(t('gitAgent.storageClearFailedItem') || 'Failed to clear item')
          }
        } catch (err) {
          notify.error(`${t('gitAgent.storageClearFailedItem') || 'Failed to clear item'}: ${String(err)}`)
        } finally {
          setBusy(false)
        }
      },
    })
  }

  const removeBrowserDatabase = (name?: string) =>
    confirm({
      title: t(name ? 'gitAgent.storageDelete' : 'gitAgent.storageClear'),
      description: name ? t('gitAgent.storageDeleteConfirm', { name }) : t('gitAgent.storageClearConfirm'),
      confirmLabel: t(name ? 'gitAgent.storageDelete' : 'gitAgent.storageClear'),
      confirmVariant: 'fail',
      onConfirm: async () => {
        setBusy(true)
        setError('')
        try {
          if (name) await deleteBrowserDatabase(name)
          else await clearBrowserStorage()
          window.location.reload()
        } catch (err) {
          await refresh()
          setError(`${t('gitAgent.storageClearFailed')} ${String(err)}`)
        }
      },
    })

  // 1. Local Filesystem Storage Mode View
  if (localInfo) {
    return (
      <SettingsSectionCard
        title="Local Data Storage"
        description="Manage local storage directory, project indexes, and runtime analysis caches."
        titleAction={
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => void refresh()}>
              <LuRefreshCw className={busy ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </Button>
            <Button variant="fail" size="sm" disabled={busy || localInfo.totalBytes === 0} onClick={handleClearCache}>
              <LuTrash2 aria-hidden="true" />
              <span>Clear Cache</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Storage Directory Path Box */}
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel-2/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LuHardDrive className="size-4 text-accent" />
                <span className="text-xs font-semibold text-ink">Local Storage Directory</span>
              </div>
              <Badge tone="accent" size="mini">
                Total: {formatBytes(localInfo.totalBytes)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2 rounded border border-line bg-panel px-2.5 py-1.5">
              <span className="font-mono text-xs text-ink truncate select-all">{maskUserHomePath(localInfo.dataPath)}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="plain" size="sm" onClick={() => void handleCopyPath()} tooltip="Copy full directory path">
                  {copied ? <LuCheck className="size-3.5 text-ok" /> : <LuCopy className="size-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
                <Button variant="default" size="sm" onClick={() => void handleReveal()} tooltip="Open in Finder / File Explorer">
                  <LuFolderOpen className="size-3.5 mr-1 text-ink-soft" />
                  <span>Open Directory</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Directory Breakdown List */}
          <ul className="divide-y divide-line/60 rounded-lg border border-line bg-panel">
            {localInfo.items.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3 p-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{item.label}</span>
                    <span className="font-mono text-[11px] text-ink-soft">({item.name})</span>
                  </div>
                  <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-mono text-xs tabular-nums text-ink">{formatBytes(item.bytes)}</span>
                  <Button
                    variant="plain"
                    size="mini"
                    disabled={!item.clearable || busy || item.bytes === 0}
                    tooltip={item.clearable ? 'Clear this cache' : 'Core configuration cannot be cleared'}
                    aria-label={`Clear ${item.label}`}
                    onClick={() => handleClearItem(item.name, item.label)}
                  >
                    <LuTrash2 className="size-3.5 text-ink-soft hover:text-danger" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </SettingsSectionCard>
    )
  }

  // 2. Edge / Browser Sandbox Fallback Mode View (IndexedDB)
  return (
    <SettingsSectionCard
      title={t('gitAgent.storageTitle')}
      description={t('gitAgent.storageDesc')}
      titleAction={
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void refresh()} aria-label={t('gitAgent.storageRefresh')}>
            <LuRefreshCw aria-hidden />
            {t('gitAgent.storageRefresh')}
          </Button>
          <Button variant="fail" size="sm" disabled={busy || sources.length === 0} onClick={() => void removeBrowserDatabase()}>
            <LuTrash2 aria-hidden />
            {t('gitAgent.storageClear')}
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-xs text-fail">
          {error}
        </p>
      )}
      <p className="text-xs text-ink-soft" aria-live="polite">
        {t('gitAgent.storageDatabaseCount', { count: sources.length })}
      </p>
      {sources.length > 0 && (
        <ul className="max-h-64 overflow-auto divide-y divide-line rounded border border-line">
          {sources.map((source) => (
            <li key={source.name} className="flex min-h-10 items-center gap-3 px-3 py-1 text-xs">
              <span className="min-w-0 flex-1 break-all font-mono">{source.name}</span>
              <Tooltip content={source.error ? t('gitAgent.storageSizeUnknown') : t('gitAgent.storageSizeHint')}>
                <span className="shrink-0 tabular-nums text-ink-soft">{source.bytes === undefined ? '—' : `≈ ${formatBytes(source.bytes)}`}</span>
              </Tooltip>
              <Button
                variant="plain"
                size="mini"
                disabled={busy}
                aria-label={t('gitAgent.storageDeleteDatabase', { name: source.name })}
                tooltip={t('gitAgent.storageDelete')}
                onClick={() => void removeBrowserDatabase(source.name)}
              >
                <LuTrash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!busy && sources.length === 0 && <p className="text-xs text-ink-soft">{t('gitAgent.storageEmpty')}</p>}
    </SettingsSectionCard>
  )
}
