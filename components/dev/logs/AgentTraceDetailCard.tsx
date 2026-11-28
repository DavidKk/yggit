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
  LuEye,
  LuFileOutput,
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

import { TraceJsonView, TraceMarkdownView } from '@/components/dev/logs/TraceMarkdownView'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, ScrollArea, Tooltip } from '@/components/sk'
import type { AgentRunTrace } from '@/lib/agent/trace-logger'
import { copyToClipboard } from '@/lib/clipboard'
import { formatDuration } from '@/lib/format-duration'
import { maskUserHomeInText, maskUserHomePath } from '@/lib/format-home-path'
import { formatJsonLikeValue } from '@/lib/format-json-like'
import { maskSensitiveTokens } from '@/lib/logger/sanitize'
import { cn } from '@/lib/utils'

const LARGE_PAYLOAD_THRESHOLD = 4000

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

function ScrollablePlainText({ text, className, scrollClassName }: { text: string; className?: string; scrollClassName?: string }) {
  return (
    <ScrollArea indicator="vertical" className={className} scrollClassName={scrollClassName}>
      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{text}</pre>
    </ScrollArea>
  )
}

function LazyPayloadView({
  payload,
  expandLabel,
  charsTemplate,
  plainTextClassName = 'bg-paper/55 text-ink',
}: {
  payload: string
  expandLabel: string
  charsTemplate: string
  plainTextClassName?: string
}) {
  const [loaded, setLoaded] = useState(false)

  if (payload.length > LARGE_PAYLOAD_THRESHOLD && !loaded) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1 font-mono text-[11px] text-ink-soft transition-colors hover:border-accent/50 hover:text-ink"
        >
          <LuBraces className="size-3 shrink-0 text-accent" aria-hidden="true" />
          <span>
            {expandLabel} ({charsTemplate.replace('{count}', String(payload.length))})
          </span>
        </button>
      </div>
    )
  }

  const trimmed = payload.trim()
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
  return looksJson ? (
    <TraceJsonView code={payload} lang="json" />
  ) : (
    <ScrollablePlainText text={payload} className={cn('max-h-44 rounded-md', plainTextClassName)} scrollClassName="px-2.5 py-2" />
  )
}

function ToolArgsBlock({ args, argsLabel, charsTemplate }: { args: unknown; argsLabel: string; charsTemplate: string }) {
  const { text: formatted, isEmpty } = formatJsonLikeValue(args)

  if (isEmpty) {
    return (
      <div className="font-mono text-ink-soft">
        {argsLabel}: {'{}'}
      </div>
    )
  }

  const sanitized = maskSensitiveTokens(maskUserHomeInText(formatted))
  return <LazyPayloadView payload={sanitized} expandLabel={argsLabel} charsTemplate={charsTemplate} plainTextClassName="bg-paper/55 text-ink-soft" />
}

function ToolOutputBlock({ ok, output, outputLabel, charsTemplate }: { ok: boolean; output: string; outputLabel: string; charsTemplate: string }) {
  const { text: formatted } = formatJsonLikeValue(output)
  const sanitized = maskSensitiveTokens(maskUserHomeInText(formatted))

  if (!ok) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-fail/8 px-2.5 py-2 font-mono text-[11px] text-fail">
        <LuCircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
        <ScrollablePlainText text={sanitized} className="max-h-44 min-w-0 flex-1" />
      </div>
    )
  }

  return <LazyPayloadView payload={sanitized} expandLabel={outputLabel} charsTemplate={charsTemplate} />
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
  const rawOutputMarkdown = maskSensitiveTokens(
    maskUserHomeInText(
      formatRawOutputMarkdown(
        trace,
        t('gitAgent.devLogsTurnOne') || 'Turn 1',
        t('gitAgent.devLogsFinalTurn') || 'Final Turn',
        t('gitAgent.devLogsEmptyValue') || 'empty'
      )
    )
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

          <p className="m-0 text-xs leading-snug font-medium text-ink break-words">{maskSensitiveTokens(trace.userPrompt)}</p>

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
                <span className="truncate">{maskUserHomePath(trace.repo)}</span>
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
            <LuFileOutput className="size-3.5" />
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
              <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px]">{maskSensitiveTokens(maskUserHomeInText(trace.error))}</pre>
            </section>
          ) : null}

          <details open className="group/sec">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 transition-colors select-none hover:bg-accent/8 [&::-webkit-details-marker]:hidden">
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

            <div className="space-y-2 px-3.5 pb-3 pt-0.5">
              {trace.matchedSkills.length > 0 ? (
                <div className="text-[11px] text-accent">
                  {t('gitAgent.devLogsSkillsLabel') || 'Skills'}: {trace.matchedSkills.join(', ')}
                </div>
              ) : null}

              {trace.toolExecutions.length > 0 ? (
                <div className="divide-y divide-line/60">
                  {trace.toolExecutions.map((exec, idx) => (
                    <div key={`${exec.name}_${idx}`} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-ink">{exec.name}</span>
                        <span className={exec.ok ? 'shrink-0 font-mono text-ok tabular-nums' : 'shrink-0 font-mono text-fail tabular-nums'}>
                          {exec.ok ? 'OK' : t('gitAgent.devLogsStatusError') || 'Failed'} · {formatDuration(exec.durationMs)}
                        </span>
                      </div>
                      <ToolArgsBlock args={exec.args} argsLabel={t('gitAgent.devLogsArgsLabel') || 'Args'} charsTemplate={charsTemplate} />
                      <ToolOutputBlock
                        ok={exec.ok}
                        output={exec.outputPreview}
                        outputLabel={t('gitAgent.devLogsSectionOutput') || 'Output'}
                        charsTemplate={charsTemplate}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[11px] text-ink-soft">{t('gitAgent.devLogsNone') || 'None'}</p>
              )}
            </div>
          </details>

          <details open className="group/sec">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 transition-colors select-none hover:bg-accent/8 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <LuTerminal className="size-3.5 text-ok" aria-hidden="true" />
                <span>{t('gitAgent.devLogsSectionOutput') || 'Output'}</span>
              </div>
              <LuChevronRight className="size-3.5 shrink-0 text-ink-soft transition-transform group-open/sec:rotate-90" aria-hidden="true" />
            </summary>

            <div className={trace.visibleContent ? 'grid grid-cols-1 gap-4 px-3.5 pb-3 pt-0.5 xl:grid-cols-2' : 'px-3.5 pb-3 pt-0.5'}>
              <div className="min-w-0">
                <TraceMarkdownView content={rawOutputMarkdown} />
              </div>
              {trace.visibleContent ? (
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <LuEye className="size-3.5 text-ok" aria-hidden="true" />
                    <span>{t('gitAgent.devLogsSectionVisibleOutput') || 'Visible Output'}</span>
                  </div>
                  <TraceMarkdownView content={maskSensitiveTokens(maskUserHomeInText(trace.visibleContent))} />
                </div>
              ) : null}
            </div>
          </details>

          <details open className="group/sec">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 transition-colors select-none hover:bg-accent/8 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <LuMessageSquare className="size-3.5 text-ok" aria-hidden="true" />
                <span>
                  {t('gitAgent.devLogsSectionMessages') || 'Messages'} ({trace.requestMessages.length})
                </span>
              </div>
              <LuChevronRight className="size-3.5 shrink-0 text-ink-soft transition-transform group-open/sec:rotate-90" aria-hidden="true" />
            </summary>

            <div className="divide-y divide-line/60 pb-3 pl-[5px]">
              {trace.requestMessages.map((msg, idx) => {
                const trimmedMsg = msg.content.trim()
                const isJsonMessage = msg.role === 'tool' || trimmedMsg.startsWith('{') || trimmedMsg.startsWith('[')
                return (
                  <details key={idx} open={msg.role !== 'system'} className="group/msg">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-l-md py-2.5 pr-3.5 pl-2.5 text-[11px] font-semibold text-ink transition-colors select-none hover:bg-accent/10 [&::-webkit-details-marker]:hidden">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge tone={msg.role === 'user' ? 'accent' : 'neutral'} size="mini" dot={false} className="min-w-4 justify-center rounded-sm px-1 font-mono tabular-nums">
                          {idx + 1}
                        </Badge>
                        <span>{msg.role}</span>
                        <span className="font-normal text-ink-soft tabular-nums">({charsTemplate.replace('{count}', String(msg.content.length))})</span>
                      </div>
                      <LuChevronRight className="size-3.5 shrink-0 text-ink-soft transition-transform group-open/msg:rotate-90" aria-hidden="true" />
                    </summary>
                    <div className="pt-1 pr-3.5 pb-3 pl-2.5">
                      {isJsonMessage ? (
                        <ToolOutputBlock
                          ok
                          output={msg.content}
                          outputLabel={msg.role === 'tool' ? t('gitAgent.devLogsSectionTools') || 'Tool' : 'JSON'}
                          charsTemplate={charsTemplate}
                        />
                      ) : (
                        <TraceMarkdownView content={maskSensitiveTokens(maskUserHomeInText(msg.content))} />
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          </details>
        </div>
      </ScrollArea>
    </aside>
  )
}
