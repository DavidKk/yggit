'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LuRefreshCw, LuTrash2 } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Tooltip } from '@/components/sk'
import { clearBrowserStorage, deleteBrowserDatabase, inspectBrowserStorage, type StorageSource } from '@/lib/storage/browser-storage'

import { SettingsSectionCard } from './SettingsSectionCard'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export function StorageSettingsSection() {
  const t = useT()
  const confirm = useConfirm()
  const [sources, setSources] = useState<StorageSource[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++generation.current
    setBusy(true)
    setError('')
    try {
      const result = await inspectBrowserStorage()
      if (current === generation.current) setSources(result)
    } catch (err) {
      if (current === generation.current) setError(String(err))
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }, [])
  useEffect(() => {
    const counter = generation
    void refresh()
    return () => {
      counter.current++
    }
  }, [refresh])

  const remove = (name?: string) =>
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

  return (
    <SettingsSectionCard
      title={t('gitAgent.storageTitle')}
      description={t('gitAgent.storageDesc')}
      titleAction={
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void refresh()} aria-label={t('gitAgent.storageRefresh')}>
            <LuRefreshCw aria-hidden />
            {t('gitAgent.storageRefresh')}
          </Button>
          <Button variant="fail" disabled={busy || sources.length === 0} onClick={() => void remove()}>
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
                onClick={() => void remove(source.name)}
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
