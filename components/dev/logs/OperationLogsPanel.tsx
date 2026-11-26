'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LuCopy, LuDownload, LuRefreshCw, LuTrash2 } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { dataTable, logBadgeClass } from '@/components/layoutClasses'
import { useNotification } from '@/components/notification/useNotification'
import { Button, EmptyState, ScrollArea, Select, TextInput, TruncateText } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'
import {
  clearAllLogs,
  generateIssueReportMarkdown,
  getMemoryLogs,
  loadPersistedLogs,
  type LogLevel,
  type LogModule,
  type ServiceLogEntry,
  subscribeLogs,
} from '@/lib/logger'
import { cn } from '@/lib/utils'

import { LogLevelMultiSelect } from './LogLevelMultiSelect'

const logsTable = cn(dataTable, 'min-w-[40rem] font-mono text-xs [--data-list-columns:5.5rem_4.5rem_7rem_minmax(0,1fr)]')

export function OperationLogsPanel({ title, desc }: { title: string; desc: string }) {
  const t = useT()
  const notify = useNotification()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<ServiceLogEntry[]>(() => getMemoryLogs())
  const [levels, setLevels] = useState<ReadonlySet<LogLevel>>(() => new Set())
  const [moduleFilter, setModuleFilter] = useState<'all' | LogModule>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    void loadPersistedLogs(200).then(setLogs)
    return subscribeLogs(setLogs)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return logs.filter((entry) => {
      if (levels.size > 0 && !levels.has(entry.level)) return false
      if (moduleFilter !== 'all' && entry.module !== moduleFilter) return false
      if (!needle) return true
      return (
        entry.message.toLowerCase().includes(needle) ||
        (entry.details || '').toLowerCase().includes(needle) ||
        entry.module.toLowerCase().includes(needle)
      )
    })
  }, [logs, levels, moduleFilter, query])

  const handleCopyReport = async () => {
    const md = generateIssueReportMarkdown(filtered)
    const ok = await copyToClipboard(md)
    if (ok) notify.success(t('gitAgent.devLogsCopiedReport') || 'Copied diagnostics report (Markdown)')
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yggit-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = async () => {
    await clearAllLogs()
    notify.success(t('gitAgent.devLogsCleared') || 'Logs cleared')
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Content Header: Title/Desc on left, compact filter/actions on right */}
      <div className="shrink-0 border-b border-line bg-paper-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 shrink-0 max-w-[36%]">
            <h1 className="text-xs font-bold text-ink truncate">{title}</h1>
            <p className="mt-0.5 text-xs text-ink-soft leading-relaxed truncate">{desc}</p>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto">
            <TextInput
              search
              clearable
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('gitAgent.devLogsSearchPlaceholder') || 'Search logs or stacks...'}
              className="w-44 shrink-0"
            />
            <LogLevelMultiSelect value={levels} onChange={setLevels} className="w-40 shrink-0" />
            <Select
              aria-label={t('gitAgent.devLogsColSource') || 'Source'}
              className="w-28 shrink-0"
              value={moduleFilter}
              options={[
                { value: 'all', label: t('gitAgent.devLogsAllModules') || 'All Modules' },
                { value: 'agent', label: 'Agent' },
                { value: 'git', label: 'Git' },
                { value: 'mcp', label: 'MCP' },
                { value: 'skill', label: 'Skill' },
                { value: 'system', label: 'System' },
              ]}
              onChange={(val) => setModuleFilter(val as 'all' | LogModule)}
            />
            <Button variant="default" size="md" className="shrink-0" onClick={() => void loadPersistedLogs(200).then(setLogs)}>
              <LuRefreshCw className="size-3.5" />
              <span>{t('gitAgent.devLogsRefresh') || 'Refresh'}</span>
            </Button>
            <Button variant="default" size="md" className="shrink-0" disabled={filtered.length === 0} onClick={() => void handleCopyReport()}>
              <LuCopy className="size-3.5" />
              <span>{t('gitAgent.devLogsCopyReport') || 'Copy Report'}</span>
            </Button>
            <Button variant="default" size="md" className="shrink-0" disabled={filtered.length === 0} onClick={handleExportJson}>
              <LuDownload className="size-3.5" />
              <span>{t('gitAgent.devLogsExport') || 'Export'}</span>
            </Button>
            <Button variant="outline-fail" size="md" className="shrink-0" disabled={logs.length === 0} onClick={() => void handleClear()}>
              <LuTrash2 className="size-3.5" />
              <span>{t('gitAgent.devLogsClear') || 'Clear'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Pure 4-column Log Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
        {!filtered.length ? (
          <EmptyState
            className="flex-1 py-12"
            title={t('gitAgent.devLogsEmptyTitle') || 'No logs yet'}
            message={t('gitAgent.devLogsEmptyMsg') || 'Operation records and errors will appear here for troubleshooting.'}
          />
        ) : (
          <div role="list" aria-label={t('gitAgent.devLogsTabLogs') || 'Logs'} className={cn(logsTable, 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
            <div data-list-head="" className="shrink-0">
              <div role="presentation" data-list-row="">
                <div data-list-heading="">{t('gitAgent.devLogsColTime') || 'Time'}</div>
                <div data-list-heading="">{t('gitAgent.devLogsColLevel') || 'Level'}</div>
                <div data-list-heading="">{t('gitAgent.devLogsColSource') || 'Source'}</div>
                <div data-list-heading="">{t('gitAgent.devLogsColMessage') || 'Message'}</div>
              </div>
            </div>
            <ScrollArea
              className="min-h-0 flex-1"
              scrollRef={scrollRef}
              indicator="both"
              scrollProps={{ 'aria-label': t('gitAgent.devLogsTabLogs') || 'Logs', tabIndex: 0 }}
            >
              <div data-list-body="">
                {filtered.map((entry) => (
                  <div role="listitem" data-list-row="" key={entry.id}>
                    <div data-list-cell="" className="whitespace-nowrap text-ink-soft tabular-nums" title={new Date(entry.timestamp).toISOString()}>
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })}
                    </div>
                    <div data-list-cell="">
                      <span className={logBadgeClass(entry.level)}>{entry.level}</span>
                    </div>
                    <div data-list-cell="" className="text-ink-soft">
                      <TruncateText text={entry.module || '—'} className="block" />
                    </div>
                    <div data-list-cell="" className="select-text">
                      <p className="m-0 whitespace-pre-wrap break-words text-ink">{entry.message}</p>
                      {entry.details ? (
                        <p className="m-0 mt-1 whitespace-pre-wrap break-all text-[0.7rem] leading-[1.35] text-ink-soft">{entry.details}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Compact Footer Count */}
      <div className="flex shrink-0 items-center justify-between border-t border-line bg-paper-2 px-3 py-1.5 text-[11px] text-ink-soft tabular-nums">
        <span>
          {(t('gitAgent.devLogsShowingCount') || 'Showing {filtered} / {total} entries')
            .replace('{filtered}', String(filtered.length))
            .replace('{total}', String(logs.length))}
        </span>
      </div>
    </main>
  )
}
