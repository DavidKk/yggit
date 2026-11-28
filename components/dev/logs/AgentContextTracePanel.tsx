'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronRight, LuCircleAlert, LuDownload, LuFileText, LuMonitor, LuRefreshCw, LuTrash2, LuZap } from 'react-icons/lu'

import { AgentTraceDetailCard } from '@/components/dev/logs/AgentTraceDetailCard'
import { useT } from '@/components/i18n/LocaleProvider'
import { dataTable } from '@/components/layoutClasses'
import { useNotification } from '@/components/notification/useNotification'
import { Button, EmptyState, ScrollArea, Select, TextInput, Tooltip } from '@/components/sk'
import { type AgentRunTrace, clearAllAgentTraces, getMemoryAgentTraces, loadPersistedAgentTraces, subscribeAgentTraces } from '@/lib/agent/trace-logger'
import { copyToClipboard } from '@/lib/clipboard'
import { formatDuration } from '@/lib/format-duration'
import { getLogRetentionPolicy } from '@/lib/logger/retention'
import { cn } from '@/lib/utils'

import { DevLogsPagination } from './DevLogsPagination'

const traceTable = cn(dataTable, 'text-xs [--data-list-columns:4.25rem_6.75rem_7.5rem_minmax(0,1fr)]')

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour12: false })
  } catch {
    return String(ts)
  }
}

export function AgentContextTracePanel({ title, desc }: { title: string; desc: string }) {
  const t = useT()
  const notify = useNotification()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [traces, setTraces] = useState<AgentRunTrace[]>(() => getMemoryAgentTraces())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const policy = useMemo(() => getLogRetentionPolicy(), [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q')
      const id = params.get('id')
      if (q) setQuery(q)
      if (id) setSelectedId(id)
    }
    void loadPersistedAgentTraces().then(setTraces)
    return subscribeAgentTraces(setTraces)
  }, [])

  const syncSelectedUrl = useCallback((nextId: string | null) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (nextId) {
      url.searchParams.set('id', nextId)
    } else {
      url.searchParams.delete('id')
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  const selectTrace = useCallback(
    (nextId: string | null) => {
      setSelectedId(nextId)
      syncSelectedUrl(nextId)
    },
    [syncSelectedUrl]
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return traces.filter((tr) => {
      if (statusFilter !== 'all' && tr.status !== statusFilter) return false
      if (!needle) return true
      return (
        tr.userPrompt.toLowerCase().includes(needle) ||
        tr.model.toLowerCase().includes(needle) ||
        tr.provider.toLowerCase().includes(needle) ||
        (tr.traceId || '').toLowerCase().includes(needle) ||
        (tr.repo || '').toLowerCase().includes(needle)
      )
    })
  }, [traces, statusFilter, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedTraces = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const selectedTrace = useMemo(() => filtered.find((item) => item.id === selectedId || item.traceId === selectedId) ?? null, [filtered, selectedId])

  useEffect(() => {
    if (!selectedTrace) return
    const idx = filtered.findIndex((item) => item.id === selectedTrace.id)
    if (idx < 0) return
    const targetPage = Math.floor(idx / pageSize) + 1
    if (targetPage !== page) {
      setPage(targetPage)
    }
  }, [filtered, page, pageSize, selectedTrace])

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize)
    setPage(1)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const handleCopyTraceId = async (traceId: string) => {
    if (!traceId) return
    const ok = await copyToClipboard(traceId)
    if (ok) notify.success(t('gitAgent.devLogsCopiedTraceId') || 'Copied Trace ID')
  }

  const handleCopyJson = async (trace: AgentRunTrace) => {
    const ok = await copyToClipboard(JSON.stringify(trace, null, 2))
    if (ok) {
      setCopiedId(trace.id)
      setTimeout(() => setCopiedId(null), 1600)
      notify.success(t('gitAgent.devLogsCopiedJson') || 'Copied trace JSON')
    }
  }

  const handleExportAll = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yggi-agent-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = async () => {
    await clearAllAgentTraces()
    selectTrace(null)
    notify.success(t('gitAgent.devLogsAgentCleared') || 'Agent logs cleared')
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Content Header: Title/Desc on left, compact filter/actions on right */}
      <div className="shrink-0 border-b border-line bg-paper-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 shrink-0 max-w-[42%]">
            <h1 className="text-xs font-bold text-ink truncate">{title}</h1>
            <p className="mt-0.5 text-xs text-ink-soft leading-relaxed truncate">{desc}</p>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto">
            <TextInput
              search
              clearable
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder={t('gitAgent.devLogsSearchAgentPlaceholder') || 'Search prompt, model, channel...'}
              className="w-48 shrink-0"
            />
            <Select
              aria-label={t('gitAgent.devLogsColStatus') || 'Status'}
              className="w-24 shrink-0"
              value={statusFilter}
              options={[
                { value: 'all', label: t('gitAgent.devLogsAllStatus') || 'All' },
                { value: 'success', label: t('gitAgent.devLogsStatusSuccess') || 'Success' },
                { value: 'error', label: t('gitAgent.devLogsStatusError') || 'Failed' },
              ]}
              onChange={(val) => {
                setStatusFilter(val as 'all' | 'success' | 'error')
                setPage(1)
              }}
            />
            <Button
              variant="outline-accent"
              size="icon"
              className="shrink-0"
              aria-label={t('gitAgent.devLogsRefresh') || 'Refresh'}
              tooltip={t('gitAgent.devLogsRefresh') || 'Refresh'}
              onClick={() => void loadPersistedAgentTraces(undefined, true).then(setTraces)}
            >
              <LuRefreshCw className="size-3.5" />
            </Button>
            <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden="true" />
            <Button
              variant="default"
              size="icon"
              className="shrink-0"
              disabled={filtered.length === 0}
              aria-label={t('gitAgent.devLogsExport') || 'Export'}
              tooltip={t('gitAgent.devLogsExport') || 'Export'}
              onClick={handleExportAll}
            >
              <LuDownload className="size-3.5" />
            </Button>
            <Button
              variant="outline-fail"
              size="icon"
              className="shrink-0"
              disabled={traces.length === 0}
              aria-label={t('gitAgent.devLogsClear') || 'Clear'}
              tooltip={t('gitAgent.devLogsClear') || 'Clear'}
              onClick={() => void handleClear()}
            >
              <LuTrash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Trace List (Left) + Standalone Detail Card / NoData (Right) */}
      <div className="flex min-h-0 flex-1 flex-row gap-0 overflow-hidden bg-paper p-0">
        <div
          role="list"
          aria-label={t('gitAgent.devLogsTabAgent') || 'Agent Logs'}
          className={cn(traceTable, 'flex min-h-0 w-[46%] min-w-[23rem] shrink-0 flex-col overflow-hidden border-r border-line bg-paper')}
        >
          {filtered.length === 0 ? (
            <EmptyState
              className="flex-1 py-12"
              title={t('gitAgent.devLogsAgentEmptyTitle') || 'No Agent logs yet'}
              message={t('gitAgent.devLogsAgentEmptyMsg') || 'Conversations with Yggi will record request context, raw responses, and tool executions here.'}
            />
          ) : (
            <>
              <div data-list-head="" className="shrink-0">
                <div role="presentation" data-list-row="">
                  <div data-list-heading="">{t('gitAgent.devLogsColTime') || 'Time'}</div>
                  <div data-list-heading="">{t('gitAgent.devLogsColTraceId') || 'Trace ID'}</div>
                  <div data-list-heading="">{t('gitAgent.devLogsColChannelModel') || 'Channel / Model'}</div>
                  <div data-list-heading="">{t('gitAgent.devLogsColPromptContext') || 'Prompt & Context'}</div>
                </div>
              </div>
              <ScrollArea className="min-h-0 flex-1" scrollRef={scrollRef} indicator="both" scrollProps={{ 'aria-label': t('gitAgent.devLogsTabAgent') || 'Agent Logs', tabIndex: 0 }}>
                <div data-list-body="">
                  {pagedTraces.map((item) => {
                    const isSelected = selectedTrace?.id === item.id
                    return (
                      <div
                        key={item.id}
                        role="listitem"
                        data-list-row=""
                        aria-current={isSelected ? 'true' : undefined}
                        onClick={() => selectTrace(isSelected ? null : item.id)}
                        className={cn('cursor-pointer transition-colors', isSelected && 'bg-accent/10 shadow-[inset_2px_0_0_var(--accent)]')}
                      >
                        <div data-list-cell="" className="whitespace-nowrap font-mono text-ink-soft tabular-nums" title={new Date(item.timestamp).toISOString()}>
                          {formatTime(item.timestamp)}
                        </div>
                        <div data-list-cell="" className="min-w-0">
                          {item.traceId ? (
                            <Tooltip content={item.traceId}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleCopyTraceId(item.traceId)
                                }}
                                className="inline-flex max-w-full cursor-pointer items-center truncate rounded px-1 py-0.5 font-mono text-[11px] text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent"
                              >
                                <span className="truncate">{item.traceId}</span>
                              </button>
                            </Tooltip>
                          ) : (
                            <span className="font-mono text-[11px] text-ink-soft">—</span>
                          )}
                        </div>
                        <div data-list-cell="" className="flex min-w-0 items-center gap-1.5 font-mono text-ink-soft" title={`${item.provider} / ${item.model}`}>
                          <LuMonitor className="size-3.5 shrink-0 opacity-75" aria-hidden="true" />
                          <span className="block truncate">
                            {item.provider} / {item.model}
                          </span>
                        </div>
                        <div data-list-cell="" className="flex min-w-0 items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {item.status === 'error' ? (
                              <Tooltip content={t('gitAgent.devLogsStatusError') || 'Failed'}>
                                <span className="inline-flex shrink-0 items-center text-fail">
                                  <LuCircleAlert className="size-3.5" />
                                </span>
                              </Tooltip>
                            ) : null}
                            <span className="truncate text-ink">{item.userPrompt}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-soft tabular-nums">
                            {item.fallbackToolCalls.length > 0 ? (
                              <Tooltip content={(t('gitAgent.devLogsFallbackTip') || 'Fallback tool calls: {count}').replace('{count}', String(item.fallbackToolCalls.length))}>
                                <span
                                  className="inline-flex items-center text-accent"
                                  aria-label={(t('gitAgent.devLogsFallbackTip') || 'Fallback tool calls: {count}').replace('{count}', String(item.fallbackToolCalls.length))}
                                >
                                  <LuZap className="size-3.5" />
                                </span>
                              </Tooltip>
                            ) : null}
                            <span>{formatDuration(item.durationMs)}</span>
                            <LuChevronRight className={cn('size-3.5 text-ink-soft transition-colors', isSelected && 'text-accent')} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel p-0">
          {selectedTrace ? (
            <AgentTraceDetailCard trace={selectedTrace} copied={copiedId === selectedTrace.id} onCopyJson={(tr) => void handleCopyJson(tr)} onClose={() => selectTrace(null)} />
          ) : (
            <EmptyState
              className="flex-1"
              icon={<LuFileText className="size-6 opacity-50" />}
              title={t('gitAgent.devLogsSelectTraceTitle') || 'No trace selected'}
              message={t('gitAgent.devLogsSelectTraceMsg') || 'Select a record from the list on the left to inspect request context, tools, and outputs.'}
            />
          )}
        </div>
      </div>

      <DevLogsPagination
        page={safePage}
        pageSize={pageSize}
        filteredCount={filtered.length}
        totalCount={traces.length}
        retentionMax={policy.maxTraces}
        retentionDays={policy.traceRetentionDays}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </main>
  )
}
