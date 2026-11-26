'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LuCheck, LuChevronDown, LuChevronRight, LuCopy, LuDownload, LuRefreshCw, LuTrash2 } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { dataTable } from '@/components/layoutClasses'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, EmptyState, ScrollArea, Select, TextInput } from '@/components/sk'
import { type AgentRunTrace, clearAllAgentTraces, getMemoryAgentTraces, loadPersistedAgentTraces, subscribeAgentTraces } from '@/lib/agent/trace-logger'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

const traceTable = cn(dataTable, 'min-w-[44rem] text-xs [--data-list-columns:5.5rem_4.5rem_13rem_minmax(0,1fr)]')

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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    void loadPersistedAgentTraces(100).then(setTraces)
    return subscribeAgentTraces(setTraces)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return traces.filter((tr) => {
      if (statusFilter !== 'all' && tr.status !== statusFilter) return false
      if (!needle) return true
      return (
        tr.userPrompt.toLowerCase().includes(needle) ||
        tr.model.toLowerCase().includes(needle) ||
        tr.provider.toLowerCase().includes(needle) ||
        (tr.repo || '').toLowerCase().includes(needle)
      )
    })
  }, [traces, statusFilter, query])

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
    setExpandedId(null)
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
              onChange={(e) => setQuery(e.target.value)}
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
              onChange={(val) => setStatusFilter(val as 'all' | 'success' | 'error')}
            />
            <Button variant="default" size="md" className="shrink-0" onClick={() => void loadPersistedAgentTraces(100).then(setTraces)}>
              <LuRefreshCw className="size-3.5" />
              <span>{t('gitAgent.devLogsRefresh') || 'Refresh'}</span>
            </Button>
            <Button variant="default" size="md" className="shrink-0" disabled={filtered.length === 0} onClick={handleExportAll}>
              <LuDownload className="size-3.5" />
              <span>{t('gitAgent.devLogsExport') || 'Export'}</span>
            </Button>
            <Button variant="outline-fail" size="md" className="shrink-0" disabled={traces.length === 0} onClick={() => void handleClear()}>
              <LuTrash2 className="size-3.5" />
              <span>{t('gitAgent.devLogsClear') || 'Clear'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Pure Trace Table + Expandable Details */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
        {filtered.length === 0 ? (
          <EmptyState
            className="flex-1 py-12"
            title={t('gitAgent.devLogsAgentEmptyTitle') || 'No Agent logs yet'}
            message={t('gitAgent.devLogsAgentEmptyMsg') || 'Conversations with Yggi will record request context, raw responses, and tool executions here.'}
          />
        ) : (
          <div role="list" aria-label={t('gitAgent.devLogsTabAgent') || 'Agent Logs'} className={cn(traceTable, 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
            <div data-list-head="" className="shrink-0">
              <div role="presentation" data-list-row="">
                <div data-list-heading="">{t('gitAgent.devLogsColTime') || 'Time'}</div>
                <div data-list-heading="">{t('gitAgent.devLogsColStatus') || 'Status'}</div>
                <div data-list-heading="">{t('gitAgent.devLogsColChannelModel') || 'Channel / Model'}</div>
                <div data-list-heading="">{t('gitAgent.devLogsColPromptContext') || 'Prompt & Context'}</div>
              </div>
            </div>
            <ScrollArea
              className="min-h-0 flex-1"
              scrollRef={scrollRef}
              indicator="both"
              scrollProps={{ 'aria-label': t('gitAgent.devLogsTabAgent') || 'Agent Logs', tabIndex: 0 }}
            >
              <div data-list-body="">
                {filtered.map((item) => {
                  const isExpanded = expandedId === item.id
                  return (
                    <React.Fragment key={item.id}>
                      <div
                        role="listitem"
                        data-list-row=""
                        onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                        className="cursor-pointer"
                      >
                        <div data-list-cell="" className="whitespace-nowrap font-mono text-ink-soft tabular-nums" title={new Date(item.timestamp).toISOString()}>
                          {formatTime(item.timestamp)}
                        </div>
                        <div data-list-cell="">
                          <Badge tone={item.status === 'error' ? 'fail' : 'ok'}>
                            {item.status === 'error' ? t('gitAgent.devLogsStatusError') || 'Failed' : t('gitAgent.devLogsStatusSuccess') || 'Success'}
                          </Badge>
                        </div>
                        <div data-list-cell="" className="truncate font-mono text-ink-soft" title={`${item.provider} / ${item.model}`}>
                          {item.provider} / {item.model}
                        </div>
                        <div data-list-cell="" className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {isExpanded ? <LuChevronDown className="size-3.5 shrink-0 text-ink-soft" /> : <LuChevronRight className="size-3.5 shrink-0 text-ink-soft" />}
                            <span className="truncate text-ink">{item.userPrompt}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-[11px] text-ink-soft tabular-nums">
                            {item.fallbackToolCalls.length > 0 && <span className="text-accent">fallback x{item.fallbackToolCalls.length}</span>}
                            {item.tokenUsage?.totalTokens ? <span>{item.tokenUsage.totalTokens} tok</span> : null}
                            <span>{item.durationMs}ms</span>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="col-span-full space-y-3 border-b border-line bg-panel-2/40 p-3 text-xs select-text">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-ink-soft">
                              {item.profileName ? `${item.profileName} · ` : ''}
                              {new Date(item.timestamp).toLocaleString()}
                              {item.repo ? ` · ${item.repo}` : ''}
                            </div>
                            <Button variant="default" size="xs" onClick={() => void handleCopyJson(item)}>
                              {copiedId === item.id ? <LuCheck className="size-3.5 text-emerald-500" /> : <LuCopy className="size-3.5" />}
                              <span>JSON</span>
                            </Button>
                          </div>

                          {item.error && (
                            <div className="rounded-lg border border-fail/35 bg-fail/10 p-2.5 text-xs text-fail">
                              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">{item.error}</pre>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-ink">
                              Tools ({item.toolNames.length} · native {item.nativeToolCalls.length} · fallback {item.fallbackToolCalls.length})
                            </div>
                            {item.matchedSkills.length > 0 && <div className="text-[11px] text-accent">Skills: {item.matchedSkills.join(', ')}</div>}
                            {item.toolExecutions.length > 0 && (
                              <div className="space-y-2">
                                {item.toolExecutions.map((exec, idx) => (
                                  <div key={`${exec.name}_${idx}`} className="rounded-lg border border-line bg-panel p-2.5 text-[11px]">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-mono font-semibold text-ink">{exec.name}</span>
                                      <span className={exec.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-fail'}>
                                        {exec.ok ? 'OK' : 'FAIL'} · {exec.durationMs}ms
                                      </span>
                                    </div>
                                    <div className="text-ink-soft font-mono break-all">Args: {JSON.stringify(exec.args)}</div>
                                    <pre className="mt-1.5 max-h-32 overflow-y-auto rounded bg-panel-2 p-2 font-mono text-[11px] text-ink whitespace-pre-wrap break-words">
                                      {exec.outputPreview}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-ink">Raw Output</div>
                              <pre className="max-h-56 overflow-y-auto rounded-lg border border-line bg-panel p-2.5 font-mono text-[11px] text-ink whitespace-pre-wrap break-words">
                                {item.rawFinalContent !== undefined
                                  ? `[Turn 1]\n${item.rawTurnOneContent || '(empty)'}\n\n[Final Turn]\n${item.rawFinalContent || '(empty)'}`
                                  : item.rawTurnOneContent || '(empty)'}
                              </pre>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-ink">Visible Output</div>
                              <pre className="max-h-56 overflow-y-auto rounded-lg border border-line bg-panel p-2.5 font-mono text-[11px] text-ink whitespace-pre-wrap break-words">
                                {item.visibleContent || '(empty)'}
                              </pre>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-ink">Request Messages ({item.requestMessages.length})</div>
                            <div className="space-y-1.5">
                              {item.requestMessages.map((msg, idx) => (
                                <details key={idx} open={msg.role !== 'system'} className="rounded-lg border border-line bg-panel px-2.5 py-2">
                                  <summary className="cursor-pointer text-[11px] font-semibold text-ink select-none">
                                    [{idx + 1}] {msg.role} ({msg.content.length} chars)
                                  </summary>
                                  <pre className="mt-2 max-h-60 overflow-y-auto font-mono text-[11px] text-ink-soft whitespace-pre-wrap break-words">{msg.content}</pre>
                                </details>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
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
            .replace('{total}', String(traces.length))}
        </span>
      </div>
    </main>
  )
}
