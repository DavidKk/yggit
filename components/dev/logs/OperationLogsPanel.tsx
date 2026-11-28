'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LuCopy, LuCpu, LuDownload, LuFilterX, LuRefreshCw, LuTrash2 } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { dataTable } from '@/components/layoutClasses'
import { useNotification } from '@/components/notification/useNotification'
import { Button, EmptyState, ScrollArea, Select, TextInput, Tooltip, TruncateText } from '@/components/sk'
import { type AgentRunTrace, getMemoryAgentTraces, loadPersistedAgentTraces, subscribeAgentTraces } from '@/lib/agent/trace-logger'
import { copyToClipboard } from '@/lib/clipboard'
import { maskUserHomeInText } from '@/lib/format-home-path'
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
import { getLogRetentionPolicy } from '@/lib/logger/retention'
import { maskSensitiveTokens } from '@/lib/logger/sanitize'
import { cn } from '@/lib/utils'

import { DevLogsPagination } from './DevLogsPagination'
import { LogLevelMultiSelect } from './LogLevelMultiSelect'

const logsTable = cn(dataTable, 'min-w-[48rem] font-mono text-xs [--data-list-columns:5.25rem_4.25rem_5.5rem_9.5rem_minmax(0,1fr)_3rem]')

const LEVEL_TEXT_CLASS: Record<LogLevel, string> = {
  error: 'font-semibold text-fail',
  warn: 'font-semibold text-warn',
  info: 'font-medium text-info',
  debug: 'font-normal text-debug',
}

export function OperationLogsPanel({ title, desc }: { title: string; desc: string }) {
  const t = useT()
  const notify = useNotification()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<ServiceLogEntry[]>(() => getMemoryLogs())
  const [agentTraces, setAgentTraces] = useState<AgentRunTrace[]>(() => getMemoryAgentTraces())
  const [levels, setLevels] = useState<ReadonlySet<LogLevel>>(() => new Set())
  const [moduleFilter, setModuleFilter] = useState<'all' | LogModule>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const policy = useMemo(() => getLogRetentionPolicy(), [])

  const agentTracesByTraceId = useMemo(() => {
    const map = new Map<string, AgentRunTrace>()
    for (const tr of agentTraces) {
      if (tr.traceId) map.set(tr.traceId, tr)
    }
    return map
  }, [agentTraces])

  const resolveLinkedAgentTrace = (entry: ServiceLogEntry): AgentRunTrace | undefined => {
    if (entry.traceId) {
      const exact = agentTracesByTraceId.get(entry.traceId)
      if (exact) return exact
    }
    if (entry.module !== 'agent' && entry.module !== 'skill') return undefined
    // Fallback for legacy persisted entries that predate shared Trace ID correlation:
    // match the trace whose execution window contains this operation log timestamp.
    return agentTraces.find((tr) => {
      const startTs = tr.timestamp - Math.max(0, tr.durationMs) - 3000
      const endTs = tr.timestamp + 3000
      return entry.timestamp >= startTs && entry.timestamp <= endTs
    })
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('q')
      if (q) setQuery(q)
    }
    void loadPersistedLogs().then(setLogs)
    void loadPersistedAgentTraces().then(setAgentTraces)
    const unsubLogs = subscribeLogs(setLogs)
    const unsubTraces = subscribeAgentTraces(setAgentTraces)
    return () => {
      unsubLogs()
      unsubTraces()
    }
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
        (entry.traceId || '').toLowerCase().includes(needle) ||
        entry.module.toLowerCase().includes(needle)
      )
    })
  }, [logs, levels, moduleFilter, query])

  const handleSelectTraceId = async (traceId: string) => {
    if (!traceId) return
    setQuery(traceId)
    setPage(1)
    const ok = await copyToClipboard(traceId)
    if (ok) notify.success(t('gitAgent.devLogsCopiedTraceId') || 'Copied Trace ID')
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedLogs = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const hasActiveFilters = Boolean(query.trim() || levels.size > 0 || moduleFilter !== 'all')

  const handleClearFilters = () => {
    setQuery('')
    setLevels(new Set())
    setModuleFilter('all')
    setPage(1)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('q')) {
        url.searchParams.delete('q')
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      }
    }
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize)
    setPage(1)
    scrollRef.current?.scrollTo({ top: 0 })
  }

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

          <ScrollArea indicator="horizontal" reserveGutter={false} className="min-w-0" scrollClassName="flex items-center justify-end gap-1.5">
            <TextInput
              search
              clearable
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder={t('gitAgent.devLogsSearchPlaceholder') || 'Search logs or stacks...'}
              className="w-44 shrink-0"
            />
            <LogLevelMultiSelect
              value={levels}
              onChange={(next) => {
                setLevels(next)
                setPage(1)
              }}
              className="w-40 shrink-0"
            />
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
                { value: 'system', label: t('gitAgent.devLogsModuleSystem') || 'System' },
              ]}
              onChange={(val) => {
                setModuleFilter(val as 'all' | LogModule)
                setPage(1)
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={!hasActiveFilters}
              aria-label={t('gitAgent.devLogsClearFilters') || 'Clear filters'}
              tooltip={t('gitAgent.devLogsClearFilters') || 'Clear filters'}
              onClick={handleClearFilters}
            >
              <LuFilterX className="size-3.5" />
            </Button>
            <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden="true" />
            <Button
              variant="outline-accent"
              size="icon"
              className="shrink-0"
              aria-label={t('gitAgent.devLogsRefresh') || 'Refresh'}
              tooltip={t('gitAgent.devLogsRefresh') || 'Refresh'}
              onClick={() => void loadPersistedLogs(undefined, true).then(setLogs)}
            >
              <LuRefreshCw className="size-3.5" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="shrink-0"
              disabled={filtered.length === 0}
              aria-label={t('gitAgent.devLogsCopyReport') || 'Copy Report'}
              tooltip={t('gitAgent.devLogsCopyReport') || 'Copy Report'}
              onClick={() => void handleCopyReport()}
            >
              <LuCopy className="size-3.5" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="shrink-0"
              disabled={filtered.length === 0}
              aria-label={t('gitAgent.devLogsExport') || 'Export'}
              tooltip={t('gitAgent.devLogsExport') || 'Export'}
              onClick={handleExportJson}
            >
              <LuDownload className="size-3.5" />
            </Button>
            <Button
              variant="outline-fail"
              size="icon"
              className="shrink-0"
              disabled={logs.length === 0}
              aria-label={t('gitAgent.devLogsClear') || 'Clear'}
              tooltip={t('gitAgent.devLogsClear') || 'Clear'}
              onClick={() => void handleClear()}
            >
              <LuTrash2 className="size-3.5" />
            </Button>
          </ScrollArea>
        </div>
      </div>

      {/* 6-column Log Table */}
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
                <div data-list-heading="">{t('gitAgent.devLogsColTraceId') || 'Trace ID'}</div>
                <div data-list-heading="">{t('gitAgent.devLogsColMessage') || 'Message'}</div>
                <div data-list-heading="" aria-hidden="true" />
              </div>
            </div>
            <ScrollArea
              className="min-h-0 flex-1"
              scrollRef={scrollRef}
              indicator="both"
              scrollProps={{ 'aria-label': t('gitAgent.devLogsTabLogs') || 'Logs', tabIndex: 0 }}
            >
              <div data-list-body="">
                {pagedLogs.map((entry) => {
                  const linkedAgentTrace = resolveLinkedAgentTrace(entry)
                  return (
                    <div role="listitem" data-list-row="" key={entry.id}>
                      <div data-list-cell="" className="whitespace-nowrap text-ink-soft tabular-nums" title={new Date(entry.timestamp).toISOString()}>
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })}
                      </div>
                      <div data-list-cell="">
                        <span className={cn('text-[0.72rem] uppercase tracking-[0.02em]', LEVEL_TEXT_CLASS[entry.level] ?? 'text-ink-soft')}>{entry.level}</span>
                      </div>
                      <div data-list-cell="" className="text-ink-soft">
                        <TruncateText text={entry.module || '—'} className="block" />
                      </div>
                      <div data-list-cell="" className="min-w-0">
                        {entry.traceId ? (
                          <Tooltip content={`${entry.traceId}`}>
                            <button
                              type="button"
                              onClick={() => void handleSelectTraceId(entry.traceId)}
                              className="inline-flex max-w-full cursor-pointer items-center truncate rounded px-1 py-0.5 font-mono text-[11px] text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent"
                            >
                              <span className="truncate">{entry.traceId}</span>
                            </button>
                          </Tooltip>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </div>
                      <div data-list-cell="" className="select-text">
                        <p className="m-0 whitespace-pre-wrap break-words text-ink">{maskSensitiveTokens(maskUserHomeInText(entry.message))}</p>
                        {entry.details ? (
                          <p className="m-0 mt-1 whitespace-pre-wrap break-all text-[0.7rem] leading-[1.35] text-ink-soft">
                            {maskSensitiveTokens(maskUserHomeInText(entry.details))}
                          </p>
                        ) : null}
                      </div>
                      <div data-list-cell="" className="flex justify-end">
                        {linkedAgentTrace ? (
                          <Tooltip content={t('gitAgent.devLogsViewAgentTrace') || 'View Agent trace'} placement="left">
                            <Link
                              href={`/dev/logs/context?id=${encodeURIComponent(linkedAgentTrace.traceId || linkedAgentTrace.id)}`}
                              aria-label={t('gitAgent.devLogsViewAgentTrace') || 'View Agent trace'}
                              className="inline-flex size-6 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-accent/12 hover:text-accent"
                            >
                              <LuCpu className="size-3.5" />
                            </Link>
                          </Tooltip>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <DevLogsPagination
        page={safePage}
        pageSize={pageSize}
        filteredCount={filtered.length}
        totalCount={logs.length}
        retentionMax={policy.maxLogs}
        retentionDays={policy.logRetentionDays}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </main>
  )
}
