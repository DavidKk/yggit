'use client'

import { useEffect, useRef, useState } from 'react'
import { LuRefreshCw, LuTrash2 } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button } from '@/components/sk'
import { clearBrowserStorage, inspectBrowserStorage, readStoragePage, STORAGE_PAGE_SIZE, type StorageEntry, type StorageSource } from '@/lib/storage/browser-storage'

import { SettingsSectionCard } from './SettingsSectionCard'

export function StorageSettingsSection() {
  const t = useT()
  const confirm = useConfirm()
  const [sources, setSources] = useState<StorageSource[]>([])
  const [selected, setSelected] = useState<StorageSource | null>(null)
  const [entries, setEntries] = useState<StorageEntry[]>([])
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = async () => {
    const current = ++generation.current
    setBusy(true)
    setError('')
    setSelected(null)
    setEntries([])
    try {
      const result = await inspectBrowserStorage()
      if (current === generation.current) setSources(result)
    } catch (err) {
      if (current === generation.current) setError(String(err))
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }
  useEffect(() => {
    const counter = generation
    void refresh()
    return () => {
      counter.current++
    }
  }, [])
  const read = async (source: StorageSource, nextPage: number) => {
    const current = ++generation.current
    setSelected(source)
    setPage(nextPage)
    setEntries([])
    setError('')
    setBusy(true)
    try {
      const result = await readStoragePage(source, nextPage * STORAGE_PAGE_SIZE)
      if (current === generation.current) setEntries(result)
    } catch (err) {
      if (current === generation.current) setError(String(err))
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }
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
          <Button
            variant="fail"
            disabled={busy}
            onClick={() =>
              void confirm({
                title: t('gitAgent.storageClear'),
                description: t('gitAgent.storageClearConfirm'),
                confirmLabel: t('gitAgent.storageClear'),
                confirmVariant: 'fail',
                onConfirm: async () => {
                  setBusy(true)
                  setError('')
                  try {
                    await clearBrowserStorage()
                    window.location.reload()
                  } catch (err) {
                    setError(`${t('gitAgent.storageClearFailed')} ${String(err)}`)
                    setBusy(false)
                  }
                },
              })
            }
          >
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
      <div className="flex max-h-64 flex-col overflow-auto rounded border border-line">
        {sources.map((source) => (
          <Button
            key={`${source.kind}:${source.name}:${source.store ?? ''}`}
            variant="plain"
            disabled={busy || !!source.error}
            className="min-h-8 shrink-0 justify-between rounded-none text-xs"
            onClick={() => void read(source, 0)}
          >
            <span className="min-w-0 truncate">
              {source.kind === 'idb' ? 'IndexedDB · ' : source.kind === 'cache' ? 'Cache Storage · ' : ''}
              {source.name}
              {source.store ? ` / ${source.store}` : ''}
            </span>
            <span>{source.error ?? source.count ?? '—'}</span>
          </Button>
        ))}
      </div>
      {!busy && sources.length === 0 && <p className="text-xs text-ink-soft">{t('gitAgent.storageEmpty')}</p>}
      {selected && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">
              {selected.name}
              {selected.store ? ` / ${selected.store}` : ''}
            </span>
            <div className="flex gap-2">
              <Button disabled={busy || page === 0} onClick={() => void read(selected, page - 1)}>
                {t('gitAgent.storagePrevious')}
              </Button>
              <Button disabled={busy || entries.length < STORAGE_PAGE_SIZE} onClick={() => void read(selected, page + 1)}>
                {t('gitAgent.storageNext')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-ink-soft">{t('gitAgent.storagePreviewHint')}</p>
          <div className="max-h-96 overflow-auto rounded border border-line">
            {entries.map((entry) => (
              <details key={entry.key} className="border-b border-line p-2 text-xs">
                <summary className="cursor-pointer break-all font-mono">{entry.key}</summary>
                <pre className="overflow-auto whitespace-pre-wrap break-all pt-2">{entry.value}</pre>
              </details>
            ))}
            {!busy && entries.length === 0 && <p className="p-2 text-xs text-ink-soft">{t('gitAgent.storageEmpty')}</p>}
          </div>
        </div>
      )}
    </SettingsSectionCard>
  )
}
