'use client'

import Link from 'next/link'
import React, { useState } from 'react'
import {
  LuBraces,
  LuCalendar,
  LuCheck,
  LuChevronRight,
  LuCircleAlert,
  LuClock,
  LuDownload,
  LuEye,
  LuHash,
  LuLink,
  LuMessageSquare,
  LuMonitor,
  LuScrollText,
  LuTerminal,
  LuWrench,
  LuX,
  LuZap,
} from 'react-icons/lu'

import { TraceMarkdownView } from '@/components/dev/logs/TraceMarkdownView'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, ScrollArea, Tooltip } from '@/components/sk'
import type { AgentRunTrace } from '@/lib/agent/trace-logger'
import { copyToClipboard } from '@/lib/clipboard'
import { formatDuration } from '@/lib/format-duration'

const LARGE_ARGS_THRESHOLD = 400

interface AgentTraceDetailCardProps {
  trace: AgentRunTrace
  copied: boolean
  onCopyJson: (trace: AgentRunTrace) => void
  onClose: () => void
}

function formatRawOutputMarkdown(trace: AgentRunTrace, turnOneLabel: string, finalTurnLabel: string, emptyLabel: string): string {
  const emptyMd = `*(${emptyLabel})*`
  const turnOne = trace.rawTurnOneContent?.trim() || emptyMd
  if (trace.rawFinalContent === undefined) {
    return turnOne
  }
  const finalTurn = trace.rawFinalContent?.trim() || emptyMd
  return `#### ${turnOneLabel}\n\n${turnOne}\n\n---\n\n#### ${finalTurnLabel}\n\n${finalTurn}`
}

function formatArgsPayload(args: unknown): { formatted: string; isEmpty: boolean; isLarge: boolean } {
  if (args == null) return { formatted: '{}', isEmpty: true, isLarge: false }
  if (typeof args === 'string') {
    const trimmed = args.trim()
    if (!trimmed || trimmed === '{}') return { formatted: '{}', isEmpty: true, isLarge: false }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const formatted = JSON.stringify(parsed, null, 2)
      return { formatted, isEmpty: false, isLarge: formatted.length > LARGE_ARGS_THRESHOLD }
    } catch {
      return { formatted: trimmed, isEmpty: false, isLarge: trimmed.length > LARGE_ARGS_THRESHOLD }
    }
  }
  if (typeof args === 'object' && !Array.isArray(args) && Object.keys(args as Record<string, unknown>).length === 0) {
    return { formatted: '{}', isEmpty: true, isLarge: false }
  }
  try {
    const formatted = JSON.stringify(args, null, 2)
    return { formatted, isEmpty: formatted === '{}', isLarge: formatted.length > LARGE_ARGS_THRESHOLD }
  } catch {
    const str = String(args)
    return { formatted: str, isEmpty: false, isLarge: str.length > LARGE_ARGS_THRESHOLD }
  }
}

function ToolArgsBlock({ args, argsLabel, charsTemplate }: { args: unknown; argsLabel: string; charsTemplate: string }) {
  const [loaded, setLoaded] = useState(false)
  const { formatted, isEmpty, isLarge } = formatArgsPayload(args)

  if (isEmpty) {
    return (
      <span className="font-mono text-ink-soft">
        {argsLabel}: {'{}'}
      </span>
    )
  }

  if (isLarge && !loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 border border-line bg-paper px-2 py-1 font-mono text-[11px] text-ink-soft transition-colors hover:border-accent/50 hover:text-ink"
      >
        <LuBraces className="size-3 shrink-0 text-accent" aria-hidden="true" />
        <span>
          {argsLabel} ({charsTemplate.replace('{count}', String(formatted.length))})
        </span>
      </button>
    )
  }

  return (
    <pre className="m-0 overflow-x-auto bg-paper/55 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-ink-soft whitespace-pre-wrap break-words">
      {formatted}
    </pre>
  )
}

/**
 * Flat, flush-tiled detail pane displaying collapsible tools, Markdown outputs, and messages.
 */
export function AgentTraceDetailCard({ trace, copied, onCopyJson, onClose }: AgentTraceDetailCardProps) {
  const t = useT()
  const notify = useNotification()

  const handleCopyTraceId = async () => {
    if (!trace.traceId) return
    const ok = await copyToClipboard(trace.traceId)
    if (ok) notify.success(t('gitAgent.devLogsCopiedTraceId') || 'Copied Trace ID')
  }

  const handleExportSingle = () => {
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yggi-trace-${trace.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fallbackTip = (t('gitAgent.devLogsFallbackTip') || 'Fallback tool calls: {count}').replace('{count}', String(trace.fallbackToolCalls.length))
  const charsTemplate = t('gitAgent.devLogsCharsCount') || '{count} chars'
  const rawOutputMarkdown = formatRawOutputMarkdown(
    trace,
    t('gitAgent.devLogsTurnOne') || 'Turn 1',
    t('gitAgent.devLogsFinalTurn') || 'Final Turn',
    t('gitAgent.devLogsEmptyValue') || 'empty'
  )

  return (
    <aside aria-label={t('gitAgent.devLogsColPromptContext') || 'Trace Details'} className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel select-text">
      {/* Flush Summary Header */}
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-panel px-3.5 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5 leading-snug">
            <LuMonitor className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-ink">
              {trace.provider} / {trace.model}
            </span>
            {trace.profileName ? <span className="text-[11px] font-medium text-ink-soft">({trace.profileName})</span> : null}
            {trace.status === 'error' ? (
              <Tooltip content={t('gitAgent.devLogsStatusError') || 'Failed'}>
                <span className="inline-flex items-center text-fail">
                  <LuCircleAlert className="size-3.5" />
                </span>
              </Tooltip>
            ) : null}
            {trace.fallbackToolCalls.length > 0 ? (
              <Tooltip content={fallbackTip}>
                <span className="inline-flex items-center text-accent">
                  <LuZap className="size-3.5" />
                </span>
              </Tooltip>
            ) : null}
          </div>

          <p className="m-0 text-xs leading-snug font-medium text-ink break-words">{trace.userPrompt}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] leading-snug text-ink-soft tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <LuCalendar className="size-3 shrink-0" aria-hidden="true" />
              <span>{new Date(trace.timestamp).toLocaleString()}</span>
            </span>
            <span className="inline-flex items-center gap-1.5" title={`${trace.durationMs}ms`}>
              <LuClock className="size-3 shrink-0" aria-hidden="true" />
              <span>{formatDuration(trace.durationMs)}</span>
            </span>
            {trace.traceId ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <Tooltip content={trace.traceId}>
                  <button
                    type="button"
                    onClick={() => void handleCopyTraceId()}
                    className="inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent"
                  >
                    <LuHash className="size-3 shrink-0" aria-hidden="true" />
                    <span>{trace.traceId}</span>
                  </button>
                </Tooltip>
                <Tooltip content={t('gitAgent.devLogsViewOpLogs') || 'View correlated operation logs'}>
                  <Link
                    href={`/dev/logs/operations?q=${encodeURIComponent(trace.traceId)}`}
                    aria-label={t('gitAgent.devLogsViewOpLogs') || 'View correlated operation logs'}
                    className="inline-flex items-center rounded p-0.5 text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent"
                  >
                    <LuScrollText className="size-3" />
                  </Link>
                </Tooltip>
              </span>
            ) : null}
            {trace.tokenUsage?.totalTokens ? <span>{trace.tokenUsage.totalTokens} tok</span> : null}
            {trace.repo ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 font-mono">
                <LuLink className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{trace.repo}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="plain"
            size="icon"
            aria-label={t('gitAgent.devLogsCopyJson') || 'Copy JSON'}
            tooltip={t('gitAgent.devLogsCopyJson') || 'Copy JSON'}
            onClick={() => onCopyJson(trace)}
          >
            {copied ? <LuCheck className="size-3.5 text-ok" /> : <LuBraces className="size-3.5" />}
          </Button>
          <Button
            variant="plain"
            size="icon"
            aria-label={t('gitAgent.devLogsExport') || 'Export'}
            tooltip={t('gitAgent.devLogsExport') || 'Export'}
            onClick={handleExportSingle}
          >
            <LuDownload className="size-3.5" />
          </Button>
          <Button
            variant="plain"
            size="icon"
            aria-label={t('common.close') || 'Close'}
            tooltip={t('common.close') || 'Close'}
            onClick={onClose}
          >
            <LuX className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Flat Collapsible Sections Divided by Hairlines + Generous Bottom Scroll Padding */}
      <ScrollArea className="min-h-0 flex-1" indicator="vertical">
        <div className="divide-y divide-line pb-16 text-xs">
          {trace.error ? (
            <section className="bg-fail/8 px-3.5 py-2.5 text-fail">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <LuCircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{t('gitAgent.devLogsStatusError') || 'Failed'}</span>
              </div>
              <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px]">{trace.error}</pre>
            </section>
          ) : null}

          <details open className="group/sec px-3.5 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <LuWrench className="size-3.5 text-ok" aria-hidden="true" />
                <span>
                  {t('gitAgent.devLogsSectionTools') || 'Tools'} ({trace.toolExecutions.length || trace.toolNames.length})
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-soft tabular-nums">
                {trace.nativeToolCalls.length > 0 ? (
                  <span>{(t('gitAgent.devLogsNativeCalls') || 'Native {count}').replace('{count}', String(trace.nativeToolCalls.length))}</span>
                ) : null}
                {trace.fallbackToolCalls.length > 0 ? (
                  <Tooltip content={fallbackTip}>
                    <span className="inline-flex items-center gap-1 text-accent">
                      <LuZap className="size-3" />
                      <span>{trace.fallbackToolCalls.length}</span>
                    </span>
                  </Tooltip>
                ) : null}
                <LuChevronRight className="size-3.5 shrink-0 text-ink-soft transition-transform group-open/sec:rotate-90" aria-hidden="true" />
              </div>
            </summary>

            <div className="mt-2.5 space-y-2">
              {trace.matchedSkills.length > 0 ? (
                <div className="text-[11px] text-accent">
                  {t('gitAgent.devLogsSkillsLabel') || 'Skills'}: {trace.matchedSkills.join(', ')}
                </div>
              ) : null}

              {trace.toolExecutions.length > 0 ? (
                <div className="divide-y divide-line/60">
                  {trace.toolExecutions.map((exec, idx) => (
                    <div key={`${exec.name}_${idx}`} className="space-y-1.5 py-2 first:pt-0 last:pb-0 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-ink">{exec.name}</span>
                        <span className={exec.ok ? 'shrink-0 font-mono text-ok tabular-nums' : 'shrink-0 font-mono text-fail tabular-nums'}>
                          {exec.ok ? 'OK' : t('gitAgent.devLogsStatusError') || 'Failed'} · {formatDuration(exec.durationMs)}
                        </span>
                      </div>
                      <ToolArgsBlock args={exec.args} argsLabel={t('gitAgent.devLogsArgsLabel') || 'Args'} charsTemplate={charsTemplate} />
                      <div
                        className={
                          exec.ok
                            ? 'max-h-36 overflow-y-auto bg-paper/55 px-2.5 py-1.5 font-mono text-[11px] text-ink whitespace-pre-wrap break-words'
                            : 'flex items-start gap-2 bg-fail/8 px-2.5 py-1.5 font-mono text-[11px] text-fail'
                        }
                      >
                        {!exec.ok ? <LuCircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> : null}
                        <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[11px]">{exec.outputPreview}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[11px] text-ink-soft">{t('gitAgent.devLogsNone') || 'None'}</p>
              )}
            </div>
          </details>

          <details open className="group/sec px-3.5 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <LuTerminal className="size-3.5 text-ok" aria-hidden="true" />
                <span>{t('gitAgent.devLogsSectionOutput') || 'Output'}</span>
              </div>
              <LuChevronRight className="size-3.5 shrink-0 text-ink-soft transition-transform group-open/sec:rotate-90" aria-hidden="true" />
            </summary>

            <div className={trace.visibleContent ? 'mt-2.5 grid grid-cols-1 gap-4 xl:grid-cols-2' : 'mt-2.5'}>
              <div className="min-w-0">
                <TraceMarkdownView content={rawOutputMarkdown} />
              </div>
              {trace.visibleContent ? (
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <LuEye className="size-3.5 text-ok" aria-hidden="true" />
                    <span>{t('gitAgent.devLogsSectionVisibleOutput') || 'Visible Output'}</span>
                  </div>
                  <TraceMarkdownView content={trace.visibleContent} />
                </div>
              ) : null}
            </div>
          </details>

          <details open className="group/sec px-3.5 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <LuMessageSquare className="size-3.5 text-ok" aria-hidden="true" />
                <span>
                  {t('gitAgent.devLogsSectionMessages') || 'Messages'} ({trace.requestMessages.length})
                </span>
              </div>
              <LuChevronRight className="size-3.5 shrink-0 text-ink-soft transition-transform group-open/sec:rotate-90" aria-hidden="true" />
            </summary>

            <div className="mt-2.5 divide-y divide-line/60">
              {trace.requestMessages.map((msg, idx) => (
                <details key={idx} open={msg.role !== 'system'} className="group/msg py-2 first:pt-0 last:pb-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-0.5 text-[11px] font-semibold text-ink select-none [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge tone={msg.role === 'user' ? 'accent' : 'neutral'} size="mini" dot={false} className="min-w-4 justify-center font-mono tabular-nums">
                        {idx + 1}
                      </Badge>
                      <span>{msg.role}</span>
                      <span className="font-normal text-ink-soft tabular-nums">({charsTemplate.replace('{count}', String(msg.content.length))})</span>
                    </div>
                    <LuChevronRight className="size-3.5 shrink-0 text-ink-soft transition-transform group-open/msg:rotate-90" aria-hidden="true" />
                  </summary>
                  <div className="mt-2">
                    <TraceMarkdownView content={msg.content} />
                  </div>
                </details>
              ))}
            </div>
          </details>
        </div>
      </ScrollArea>
    </aside>
  )
}
