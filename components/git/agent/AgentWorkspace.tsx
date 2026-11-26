'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuBot,
  LuCheck,
  LuCircleAlert,
  LuClock,
  LuCopy,
  LuCpu,
  LuFileText,
  LuFolderGit2,
  LuGitBranch,
  LuReply,
  LuRotateCcw,
  LuSearch,
  LuSend,
  LuShieldAlert,
  LuTrash2,
  LuX,
} from 'react-icons/lu'

import { PanelSplitter } from '@/components/git/PanelSplitter'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner, Tooltip } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import type { AgentOpenEventDetail, AgentReference } from '@/lib/agent/agent-quote'
import { isModelAllowed } from '@/lib/agent/model-filter'
import { getAgentProcessingStatus, getToolExecutionStatus } from '@/lib/agent/status-helper'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

import { AgentFairyIcon } from './AgentFairyIcon'
import { AgentQuickModelPopover } from './AgentQuickModelPopover'
import { GitAgentAssistiveReminder } from './GitAgentAssistiveReminder'

interface Props {
  repoPath?: string
  className?: string
}

interface AgentCapability {
  id: string
  title: string
  description: string
  prompt: string
  icon: React.ComponentType<{ className?: string }>
}

const CAPABILITY_ICONS = {
  branches: LuGitBranch,
  status: LuFolderGit2,
  search: LuSearch,
  details: LuFileText,
} as const

const SIDEBAR_WIDTH_STORAGE_KEY = 'yggit.agent.sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 440
const MIN_SIDEBAR_WIDTH = 320
const MAX_SIDEBAR_WIDTH = 720

function clampSidebarWidth(width: number): number {
  const viewportMax = typeof window !== 'undefined' ? Math.max(MIN_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.65)) : MAX_SIDEBAR_WIDTH
  return Math.min(Math.min(MAX_SIDEBAR_WIDTH, viewportMax), Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)))
}

export function AgentWorkspace({ repoPath, className }: Props) {
  const t = useT()
  const { dockMode, setDockMode, messages, sendMessage, retryMessage, clearMessages, isProcessing, activeRepo, config, modelFilter } = useAgent()

  const [input, setInput] = useState('')
  const [reference, setReference] = useState<AgentReference | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const capabilities: AgentCapability[] = useMemo(
    () => [
      {
        id: 'branches',
        title: t('gitAgent.capBranchesTitle') || 'Branch Stats & List',
        description: t('gitAgent.capBranchesDesc') || 'Count total branches and list local and remote branches',
        prompt: t('gitAgent.capBranchesPrompt') || 'How many branches are there? Count them and list local and remote branches.',
        icon: CAPABILITY_ICONS.branches,
      },
      {
        id: 'status',
        title: t('gitAgent.capStatusTitle') || 'Current HEAD & Workspace',
        description: t('gitAgent.capStatusDesc') || 'Check the checked-out branch, latest commit, and working tree status',
        prompt: t('gitAgent.capStatusPrompt') || 'Which branch am I on, and what is the latest commit?',
        icon: CAPABILITY_ICONS.status,
      },
      {
        id: 'search',
        title: t('gitAgent.capSearchTitle') || 'Search Commits by Author/Keyword',
        description: t('gitAgent.capSearchDesc') || 'Filter and locate commits by keyword, author, or time range',
        prompt: t('gitAgent.capSearchPrompt') || 'Search commits from the last 3 days, sorted by time',
        icon: CAPABILITY_ICONS.search,
      },
      {
        id: 'details',
        title: t('gitAgent.capDetailsTitle') || 'Commit Details & File Changes',
        description: t('gitAgent.capDetailsDesc') || 'View changed files and diff stats for a specific commit',
        prompt: t('gitAgent.capDetailsPrompt') || 'Show changed files and diff stats for the latest commit',
        icon: CAPABILITY_ICONS.details,
      },
    ],
    [t]
  )

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarWidthRef = useRef(sidebarWidth)
  sidebarWidthRef.current = sidebarWidth
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
      if (!raw) return
      const parsed = Number.parseInt(raw, 10)
      if (Number.isFinite(parsed)) {
        setSidebarWidth(clampSidebarWidth(parsed))
      }
    } catch {
      // Ignore storage access errors
    }
  }, [])

  const effectiveRepo = repoPath || activeRepo || ''
  const isModelBlocked = !isModelAllowed(config.model, modelFilter)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<AgentOpenEventDetail>).detail
      // If bottom bar was explicitly targeted, or if sidebar is collapsed and not explicitly targeted:
      if (detail?.target === 'bottom') return
      if (dockMode === 'collapsed' && detail?.target !== 'sidebar') return

      if (dockMode === 'collapsed' && detail?.target === 'sidebar') {
        setDockMode('dock-right')
      }
      if (detail?.reference) {
        setReference(detail.reference)
        setTimeout(() => inputRef.current?.focus(), 150)
      } else if (detail?.prompt) {
        setInput(detail.prompt)
        setTimeout(() => inputRef.current?.focus(), 150)
      }
    }
    window.addEventListener('yggit:agent_open', handleOpen)
    return () => window.removeEventListener('yggit:agent_open', handleOpen)
  }, [dockMode, setDockMode])

  const handleSendPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim()
      if (!trimmed || isProcessing || isModelBlocked) return
      setInput('')
      await sendMessage(trimmed, effectiveRepo)
    },
    [isProcessing, isModelBlocked, sendMessage, effectiveRepo]
  )

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if ((!trimmed && !reference) || isProcessing || isModelBlocked) return

    let finalPrompt = trimmed
    let llmPrompt: string | undefined
    let quotedMessage: { id: string; role: 'user' | 'assistant'; content: string } | undefined

    if (reference) {
      if (reference.kind === 'reply' && typeof reference.quotedMessageId === 'string') {
        const quotedContent = String(reference.summary || reference.title || '')
        quotedMessage = {
          id: reference.quotedMessageId,
          role: reference.quotedRole === 'user' ? 'user' : 'assistant',
          content: quotedContent,
        }
        finalPrompt = trimmed || quotedContent
        llmPrompt = trimmed ? `Quoted message:\n> ${quotedContent.slice(0, 300)}\n\nFollow-up: ${trimmed}` : quotedContent
      } else if (trimmed) {
        finalPrompt = `${reference.prompt || reference.title}\n\nFollow-up question: ${trimmed}`
      } else {
        finalPrompt = reference.prompt || reference.title
      }
    }

    setInput('')
    setReference(null)
    await sendMessage(finalPrompt, effectiveRepo, quotedMessage ? { quotedMessage, llmPrompt } : undefined)
  }

  const handleCopy = (id: string, text: string) => {
    void copyToClipboard(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const isCollapsed = dockMode === 'collapsed'

  const persistSidebarWidth = useCallback((width: number) => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(width)))
    } catch {
      // Ignore storage access errors
    }
  }, [])

  return (
    <>
      {!isCollapsed && (
        <PanelSplitter
          label={t('gitAgent.resizeSidebar') || 'Resize Yggi sidebar'}
          value={sidebarWidth}
          min={MIN_SIDEBAR_WIDTH}
          max={MAX_SIDEBAR_WIDTH}
          onResize={(delta) => {
            setIsResizing(true)
            setSidebarWidth((prev) => clampSidebarWidth(prev - delta))
          }}
          onResizeEnd={() => {
            setIsResizing(false)
            persistSidebarWidth(sidebarWidthRef.current)
          }}
          onAutoFit={() => {
            setIsResizing(false)
            setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
            persistSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
          }}
        />
      )}
      <aside
        data-agent-sidebar=""
        role="region"
        aria-label={t('gitAgent.dockTitle')}
        aria-hidden={isCollapsed || undefined}
        style={{ width: isCollapsed ? 0 : sidebarWidth }}
        className={cn(
          'z-20 flex flex-col bg-panel shrink-0 overflow-hidden max-w-full h-full',
          isResizing ? 'transition-none' : 'transition-[width] duration-200 ease-out',
          isCollapsed ? 'border-l-0 shadow-none pointer-events-none' : 'border-l border-line shadow-2xl',
          className
        )}
      >
        <div className="flex h-full min-h-0 flex-col" style={{ width: sidebarWidth }}>
          {/* Workspace Header - h-10 to match File Panel (GitCommitPanel) header height */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-2.5 bg-panel-2/70 select-none">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-ink truncate">{t('gitAgent.dockTitle')}</span>
              {effectiveRepo ? (
                <span className="text-[11px] text-ink-soft truncate max-w-[140px]" title={effectiveRepo}>
                  · {effectiveRepo.split('/').pop() || effectiveRepo}
                </span>
              ) : null}
              {isProcessing ? (
                <div className="flex items-center gap-1 text-[11px] text-accent shrink-0 font-medium ml-1">
                  <Spinner className="size-3" />
                  <span>{t('gitAgent.analyzing')}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {/* Clear Messages */}
              <Tooltip content={t('gitAgent.clearHistory')} placement="bottom">
                <button
                  type="button"
                  onClick={clearMessages}
                  className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer"
                  aria-label={t('gitAgent.clearHistory')}
                >
                  <LuTrash2 className="size-3.5" />
                </button>
              </Tooltip>

              {/* Quick Model & Channel Popover */}
              <AgentQuickModelPopover side="bottom" className="size-6 rounded hover:bg-[var(--overlay-06)] hover:text-ink" />

              {/* Close Dock */}
              <Tooltip content={t('common.close') || 'Close'} placement="bottom">
                <button
                  type="button"
                  onClick={() => setDockMode('collapsed')}
                  className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer"
                  aria-label={t('common.close') || 'Close'}
                >
                  <LuX className="size-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
            <GitAgentAssistiveReminder variant="embedded" />

            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-2 py-6">
                <AgentFairyIcon className="size-10" active={isProcessing} />
                <div className="space-y-1 max-w-sm">
                  <p className="text-xs font-semibold text-ink">{t('gitAgent.welcomeTitle')}</p>
                  <p className="text-[11px] text-ink-soft leading-relaxed">{t('gitAgent.welcomeDesc')}</p>
                </div>

                {/* Quick Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md mt-2">
                  {capabilities.map((cap) => {
                    const Icon = cap.icon
                    return (
                      <button
                        key={cap.id}
                        type="button"
                        onClick={() => handleSendPrompt(cap.prompt)}
                        className="flex flex-col gap-0.5 rounded-lg border border-line/80 bg-panel-2/60 p-2.5 text-left hover:border-accent hover:bg-panel transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-medium text-ink group-hover:text-accent">
                          <Icon className="size-3.5 shrink-0 text-accent" />
                          <span className="truncate">{cap.title}</span>
                        </div>
                        <span className="text-[11px] text-ink-soft leading-relaxed">{cap.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              messages.map((m, index) => {
                const isUser = m.role === 'user'
                const isTool = m.role === 'tool'

                if (isTool) {
                  return null
                }

                // Do not render empty assistant bubble (e.g. intermediate turn with tool calls)
                if (!isUser && !m.content?.trim() && !m.isStreaming) {
                  return null
                }

                const isError = !isUser && Boolean(m.isError)

                const timeLabel = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
                const durationLabel = typeof m.durationMs === 'number' ? (m.durationMs >= 1000 ? `${(m.durationMs / 1000).toFixed(1)}s` : `${m.durationMs}ms`) : ''
                const totalTokens =
                  m.tokenUsage?.totalTokens ??
                  (typeof m.tokenUsage?.promptTokens === 'number' || typeof m.tokenUsage?.completionTokens === 'number'
                    ? (m.tokenUsage?.promptTokens || 0) + (m.tokenUsage?.completionTokens || 0)
                    : undefined)

                return (
                  <div key={m.id} id={`agent-msg-${m.id}`} className={cn('group flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
                    {isUser && m.quotedMessage && (
                      <div className="flex max-w-[85%] flex-col items-end">
                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById(`agent-msg-${m.quotedMessage?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }}
                          className="rounded-xl border border-line/80 bg-panel-2/85 px-3 py-1.5 text-left text-[11px] leading-relaxed text-ink-soft hover:border-accent/50 hover:text-ink transition-colors cursor-pointer shadow-2xs"
                          title={t('gitAgent.jumpToOriginalMessage') || 'Jump to original message'}
                        >
                          <div className="line-clamp-2 whitespace-pre-wrap">{m.quotedMessage.content}</div>
                        </button>
                        <svg width="24" height="14" viewBox="0 0 24 14" fill="none" aria-hidden="true" className="mr-3 text-accent/65 shrink-0">
                          <path d="M4 1 C14 1, 18 4, 18 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          <path d="M14.5 8.5 L18 12 L21.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    <div
                      className={cn(
                        'relative max-w-[90%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed select-text shadow-xs break-words',
                        isUser
                          ? 'bg-accent text-white rounded-tr-xs selection:bg-black/30 selection:text-white'
                          : isError
                            ? 'border border-fail/35 bg-fail/10 text-ink rounded-tl-xs'
                            : 'bg-panel-2 border border-line text-ink rounded-tl-xs'
                      )}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap selection:bg-black/30 selection:text-white">{m.content}</div>
                      ) : isError ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-fail">
                            <LuCircleAlert className="size-3.5 shrink-0" />
                            <span>{t('gitAgent.requestFailed') || 'Request failed'}</span>
                          </div>
                          <div className="whitespace-pre-wrap text-ink/90 pr-5">{m.content}</div>
                          <div className="flex items-center gap-3 pt-0.5">
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => void retryMessage(m.id)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-fail/30 bg-panel px-2.5 py-1 text-[11px] font-medium text-ink hover:border-fail/60 hover:bg-fail/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <LuRotateCcw className="size-3 text-fail" />
                              <span>{t('gitAgent.retry') || 'Retry'}</span>
                            </button>
                            <Link href="/dev/logs/operations" className="text-[11px] text-ink-soft hover:text-accent hover:underline">
                              {t('gitAgent.viewDiagnosticsLog') || 'View Diagnostics Log'}
                            </Link>
                          </div>
                        </div>
                      ) : m.content ? (
                        <FormattedMessage content={m.content} />
                      ) : m.isStreaming ? (
                        <div className="flex items-center gap-1.5 text-ink-soft py-0.5">
                          <Spinner className="size-3 text-accent shrink-0" />
                          <span>
                            {m.statusTool
                              ? getToolExecutionStatus(m.statusTool.name, m.statusTool.branch ? { branch: m.statusTool.branch } : undefined, t)
                              : getAgentProcessingStatus(
                                  messages
                                    .slice(0, index)
                                    .reverse()
                                    .find((item) => item.role === 'user')?.content,
                                  t
                                )}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {m.content && !m.isStreaming && (
                      <div
                        className={cn(
                          'flex items-center gap-1 px-1 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100',
                          isUser ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <Tooltip content={copiedId === m.id ? t('gitAgent.copied') || 'Copied' : t('gitAgent.copyAnswer') || 'Copy'} placement="top">
                          <button
                            type="button"
                            onClick={() => handleCopy(m.id, m.content)}
                            className="inline-flex size-5 items-center justify-center rounded hover:bg-[var(--overlay-06)] hover:text-ink cursor-pointer"
                            aria-label={t('gitAgent.copyAnswer') || 'Copy'}
                          >
                            {copiedId === m.id ? <LuCheck className="size-3 text-emerald-500" /> : <LuCopy className="size-3" />}
                          </button>
                        </Tooltip>
                        <Tooltip content={t('gitAgent.quoteReply') || 'Quote reply'} placement="top">
                          <button
                            type="button"
                            onClick={() => {
                              const preview = m.content.replace(/\s+/g, ' ').trim().slice(0, 48)
                              setReference({
                                kind: 'reply',
                                title: preview || t('gitAgent.quoteReply') || 'Quote reply',
                                summary: m.content,
                                quotedMessageId: m.id,
                                quotedRole: m.role,
                              })
                              setTimeout(() => inputRef.current?.focus(), 0)
                            }}
                            className="inline-flex size-5 items-center justify-center rounded hover:bg-[var(--overlay-06)] hover:text-ink cursor-pointer"
                            aria-label={t('gitAgent.quoteReply') || 'Quote reply'}
                          >
                            <LuReply className="size-3" />
                          </button>
                        </Tooltip>
                        {totalTokens !== undefined && (
                          <Tooltip content={(t('gitAgent.tokenUsageLabel') || 'Tokens: {count}').replace('{count}', String(totalTokens))} placement="top">
                            <span
                              tabIndex={0}
                              aria-label={(t('gitAgent.tokenUsageLabel') || 'Tokens: {count}').replace('{count}', String(totalTokens))}
                              className="inline-flex size-5 items-center justify-center rounded hover:bg-[var(--overlay-06)] hover:text-ink cursor-default"
                            >
                              <LuCpu className="size-3" />
                            </span>
                          </Tooltip>
                        )}
                        {(timeLabel || durationLabel) && (
                          <Tooltip content={`${timeLabel}${timeLabel && durationLabel ? ' · ' : ''}${durationLabel}`} placement="top">
                            <span
                              tabIndex={0}
                              aria-label={`${timeLabel}${timeLabel && durationLabel ? ' · ' : ''}${durationLabel}`}
                              className="inline-flex size-5 items-center justify-center rounded hover:bg-[var(--overlay-06)] hover:text-ink cursor-default"
                            >
                              <LuClock className="size-3" />
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="border-t border-line bg-panel flex flex-col">
            {isModelBlocked && (
              <div className="mx-2.5 mt-2 flex items-center gap-1.5 rounded border border-fail/30 bg-fail/10 px-2 py-1 text-[11px] text-fail font-medium">
                <LuShieldAlert className="size-3.5 shrink-0" />
                <span>{t('gitAgent.modelBlockedNotice')}</span>
              </div>
            )}

            {/* Reference Citation Badge */}
            {reference && (
              <div className="flex items-center px-2.5 pt-2">
                <span
                  className="flex max-w-full items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent animate-in fade-in zoom-in-95 duration-150"
                  title={reference.title}
                >
                  <LuBot className="size-3 shrink-0 text-accent" aria-hidden="true" />
                  <span className="truncate">{reference.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setReference(null)
                    }}
                    className="ml-0.5 rounded-full p-0.5 text-accent/70 hover:bg-accent/20 hover:text-accent focus:outline-none cursor-pointer"
                    title={t('common.remove') || 'Remove'}
                    aria-label={t('common.remove') || 'Remove'}
                  >
                    <LuX className="size-3" />
                  </button>
                </span>
              </div>
            )}

            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              disabled={isProcessing || isModelBlocked}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder={reference ? 'Ask Yggi a follow-up or press Enter to send...' : isModelBlocked ? t('gitAgent.modelBlockedNotice') : t('gitAgent.inputPlaceholder')}
              className="w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-xs leading-relaxed text-ink placeholder:text-ink-soft/60 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-end px-2.5 pb-2 pt-0.5">
              <Tooltip content={isModelBlocked ? t('gitAgent.modelBlockedNotice') : 'Send message'}>
                <span className="inline-flex shrink-0">
                  <Button type="submit" variant="accent" size="icon" disabled={(!input.trim() && !reference) || isProcessing || isModelBlocked} aria-label="Send message">
                    {isProcessing ? <Spinner className="size-3.5" /> : <LuSend className="size-3.5" />}
                  </Button>
                </span>
              </Tooltip>
            </div>
          </form>
        </div>
      </aside>
    </>
  )
}

/** Formats LLM responses with simple markdown parsing for readability. */
export function FormattedMessage({ content }: { content: string }) {
  const parts = useMemo(() => {
    const lines = content.split('\n')
    return lines.map((line, index) => {
      // Bullet list item
      if (/^[-*]\s+/.test(line)) {
        const itemText = line.replace(/^[-*]\s+/, '')
        return (
          <li key={index} className="ml-3.5 list-disc my-0.5">
            <InlineFormatted text={itemText} />
          </li>
        )
      }
      // Numbered list item
      if (/^\d+\.\s+/.test(line)) {
        const itemText = line.replace(/^\d+\.\s+/, '')
        return (
          <li key={index} className="ml-3.5 list-decimal my-0.5">
            <InlineFormatted text={itemText} />
          </li>
        )
      }
      // Heading
      if (/^#{1,3}\s+/.test(line)) {
        const headingText = line.replace(/^#{1,3}\s+/, '')
        return (
          <p key={index} className="font-semibold text-ink my-1">
            <InlineFormatted text={headingText} />
          </p>
        )
      }
      // Empty line
      if (!line.trim()) {
        return <div key={index} className="h-1.5" />
      }
      // Standard paragraph line
      return (
        <p key={index} className="my-0.5">
          <InlineFormatted text={line} />
        </p>
      )
    })
  }, [content])

  return <div className="space-y-0.5 leading-relaxed">{parts}</div>
}

/** Formats inline bold, inline code, and commit hashes. */
function InlineFormatted({ text }: { text: string }) {
  // Regex to split by `code`, **bold**, or standard text
  const tokens = useMemo(() => {
    const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
    return text.split(regex).filter(Boolean)
  }, [text])

  return (
    <>
      {tokens.map((token, idx) => {
        if (token.startsWith('`') && token.endsWith('`')) {
          return (
            <code key={idx} className="rounded bg-[var(--overlay-10)] px-1 py-0.5 font-mono text-[11px] text-accent font-medium mx-0.5">
              {token.slice(1, -1)}
            </code>
          )
        }
        if (token.startsWith('**') && token.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold text-ink">
              {token.slice(2, -2)}
            </strong>
          )
        }
        return <span key={idx}>{token}</span>
      })}
    </>
  )
}
