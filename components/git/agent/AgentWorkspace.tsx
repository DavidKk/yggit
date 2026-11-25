'use client'

import { Popover } from '@base-ui/react/popover'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuArrowUpRight,
  LuBot,
  LuCheck,
  LuCircleAlert,
  LuClock,
  LuCopy,
  LuFileText,
  LuFolderGit2,
  LuGitBranch,
  LuGitMerge,
  LuGitPullRequest,
  LuRotateCcw,
  LuSearch,
  LuSend,
  LuSettings,
  LuShieldAlert,
  LuSparkles,
  LuTrash2,
  LuUser,
  LuX,
} from 'react-icons/lu'

import { PanelSplitter } from '@/components/git/PanelSplitter'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner, SwitchToggle, Tooltip } from '@/components/sk'
import { dropdownPopupClass } from '@/components/sk/dropdownMenu'
import { useAgent } from '@/lib/agent/agent-context'
import type { AgentOpenEventDetail, AgentReference } from '@/lib/agent/agent-quote'
import { isModelAllowed } from '@/lib/agent/model-filter'
import { getAgentProcessingStatus, getToolExecutionStatus } from '@/lib/agent/status-helper'
import { copyToClipboard } from '@/lib/clipboard'
import { saveLastGitUrl } from '@/lib/git/last-git-url'
import { cn } from '@/lib/utils'

import { GitAgentAssistiveReminder } from './GitAgentAssistiveReminder'

interface Props {
  repoPath?: string
  className?: string
}

interface AgentCapability {
  id: string
  category: string
  title: string
  description: string
  prompt: string
  icon: React.ComponentType<{ className?: string }>
}

const CAPABILITIES: AgentCapability[] = [
  {
    id: 'branches',
    category: '分支与状态',
    title: '分支统计与清单',
    description: '统计仓库分支总数，列出本地分支与远程分支',
    prompt: '当前分支有多少个？请统计分支数量，并列出本地与远程分支。',
    icon: LuGitBranch,
  },
  {
    id: 'status',
    category: '分支与状态',
    title: '当前 HEAD 与工作区',
    description: '查看当前检出分支、最新一次提交与工作区状态',
    prompt: '当前在哪个分支？最新的一次 Commit 是什么？',
    icon: LuFolderGit2,
  },
  {
    id: 'unmerged',
    category: '合入与诊断',
    title: '未合并分支排查',
    description: '查看当前仓库还有哪些分支未合并到 master/main 主干',
    prompt: '帮我看看当前还有多少个分支还没合并到 MASTER？',
    icon: LuGitPullRequest,
  },
  {
    id: 'containment',
    category: '合入与诊断',
    title: '分支合入与污染检测',
    description: '验证当前分支或特性分支是否已合入目标主干',
    prompt: '验证当前分支有没有合入 master 分支，是否存在未合入或污染提交？',
    icon: LuGitMerge,
  },
  {
    id: 'merges',
    category: '合入与诊断',
    title: '今日/近期 Merge 清单',
    description: '检索今日或近期合并的提交详情与改动说明',
    prompt: '查询今日的所有 Merge 提交记录与改动说明',
    icon: LuClock,
  },
  {
    id: 'search',
    category: '检索与审计',
    title: '按作者/关键字搜提交',
    description: '按关键字、作者或时间范围筛选定位相关提交',
    prompt: '搜索最近 3 天内的提交记录，按时间排序',
    icon: LuSearch,
  },
  {
    id: 'details',
    category: '检索与审计',
    title: '提交详情与文件变动',
    description: '查看指定 Commit 修改的文件清单与改动统计',
    prompt: '查看最新提交修改了哪些文件与差异统计',
    icon: LuFileText,
  },
]

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
  const {
    dockMode,
    setDockMode,
    messages,
    sendMessage,
    retryMessage,
    clearMessages,
    isProcessing,
    activeRepo,
    config,
    modelFilter,
    profiles,
    activeProfileId,
    selectProfile,
    redactionOptions,
    setRedactionOptions,
  } = useAgent()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [input, setInput] = useState('')
  const [reference, setReference] = useState<AgentReference | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
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
    if (reference) {
      if (trimmed) {
        finalPrompt = `${reference.prompt || reference.title}\n\n用户附加提问: ${trimmed}`
      } else {
        finalPrompt = reference.prompt || reference.title
      }
    }

    setInput('')
    setReference(null)
    await sendMessage(finalPrompt, effectiveRepo)
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
          label={t('gitAgent.resizeSidebar') || '调整 Agent 侧栏宽度'}
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
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <LuSparkles className="size-3" />
              </div>
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

              {/* Quick Settings Popover */}
              <Popover.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
                <Tooltip content={t('gitAgent.sidebarQuickSettings') || t('gitAgent.settingsTitle')} placement="bottom">
                  <Popover.Trigger
                    className={cn(
                      'flex size-6 items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer',
                      settingsOpen && 'bg-[var(--overlay-08)] text-ink'
                    )}
                    aria-label={t('gitAgent.sidebarQuickSettings') || t('gitAgent.settingsTitle')}
                  >
                    <LuSettings className="size-3.5" />
                  </Popover.Trigger>
                </Tooltip>
                <Popover.Portal>
                  <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
                    <Popover.Popup className={cn(dropdownPopupClass, 'w-64 p-2.5 flex flex-col gap-2.5')}>
                      <div className="flex flex-col gap-1">
                        <span className="px-1 text-[11px] font-semibold text-ink-soft">{t('gitAgent.sidebarActiveChannel') || '当前模型渠道'}</span>
                        <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                          {profiles
                            .filter((p) => p.enabled !== false)
                            .map((profile) => {
                              const isActive = profile.id === activeProfileId
                              return (
                                <button
                                  key={profile.id}
                                  type="button"
                                  onClick={() => {
                                    selectProfile(profile.id)
                                    setSettingsOpen(false)
                                  }}
                                  className={cn(
                                    'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors cursor-pointer',
                                    isActive ? 'bg-accent/12 text-accent font-medium' : 'text-ink hover:bg-[var(--overlay-06)]'
                                  )}
                                >
                                  <span className="min-w-0 truncate">{profile.name || profile.config.model}</span>
                                  {isActive && <LuCheck className="size-3.5 shrink-0 text-accent" aria-hidden="true" />}
                                </button>
                              )
                            })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-line pt-2 px-1">
                        <span className="text-xs text-ink">{t('gitAgent.privacyRedactTitle') || '客户端自动脱敏'}</span>
                        <SwitchToggle
                          size="sm"
                          checked={redactionOptions.enabled}
                          aria-label={t('gitAgent.privacyRedactTitle') || '客户端自动脱敏'}
                          onCheckedChange={(enabled) => setRedactionOptions({ ...redactionOptions, enabled })}
                        />
                      </div>

                      <Link
                        href="/settings/models"
                        onClick={() => {
                          setSettingsOpen(false)
                          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/git')) {
                            saveLastGitUrl(window.location.pathname + window.location.search)
                          }
                        }}
                        className="flex items-center justify-between rounded border-t border-line pt-2 px-1 text-xs font-medium text-accent hover:underline"
                      >
                        <span>{t('gitAgent.sidebarOpenFullSettings') || '前往模型与接入设置'}</span>
                        <LuArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                      </Link>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>

              {/* Close Dock */}
              <Tooltip content={t('common.close') || '关闭'} placement="bottom">
                <button
                  type="button"
                  onClick={() => setDockMode('collapsed')}
                  className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer"
                  aria-label={t('common.close') || '关闭'}
                >
                  <LuX className="size-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <GitAgentAssistiveReminder variant="embedded" />

            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-2 py-6">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-xs">
                  <LuBot className="size-5" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-xs font-semibold text-ink">{t('gitAgent.welcomeTitle')}</p>
                  <p className="text-[11px] text-ink-soft leading-relaxed">{t('gitAgent.welcomeDesc')}</p>
                </div>

                {/* Quick Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md mt-2">
                  {CAPABILITIES.map((cap) => {
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

                return (
                  <div key={m.id} className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
                    <div className="flex items-center gap-1.5 text-[10px] text-ink-soft px-1">
                      {isUser ? (
                        <>
                          <span>You</span>
                          <LuUser className="size-3" />
                        </>
                      ) : (
                        <>
                          <LuBot className={cn('size-3', isError ? 'text-fail' : 'text-accent')} />
                          <span className="font-medium text-ink">Git Agent</span>
                        </>
                      )}
                    </div>

                    <div
                      className={cn(
                        'group relative max-w-[90%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed select-text shadow-xs break-words',
                        isUser
                          ? 'bg-accent text-white rounded-tr-xs'
                          : isError
                            ? 'border border-fail/35 bg-fail/10 text-ink rounded-tl-xs'
                            : 'bg-panel-2 border border-line text-ink rounded-tl-xs'
                      )}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      ) : isError ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-fail">
                            <LuCircleAlert className="size-3.5 shrink-0" />
                            <span>{t('gitAgent.requestFailed') || '请求失败'}</span>
                          </div>
                          <div className="whitespace-pre-wrap text-ink/90 pr-5">{m.content}</div>
                          <div className="flex items-center pt-0.5">
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => void retryMessage(m.id)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-fail/30 bg-panel px-2.5 py-1 text-[11px] font-medium text-ink hover:border-fail/60 hover:bg-fail/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <LuRotateCcw className="size-3 text-fail" />
                              <span>{t('gitAgent.retry') || '重试'}</span>
                            </button>
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

                      {!isUser && m.content && (
                        <button
                          type="button"
                          onClick={() => handleCopy(m.id, m.content)}
                          className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-ink-soft hover:text-ink bg-panel/80 hover:bg-panel cursor-pointer"
                          title={t('gitAgent.copyAnswer')}
                        >
                          {copiedId === m.id ? <LuCheck className="size-3 text-emerald-500" /> : <LuCopy className="size-3" />}
                        </button>
                      )}
                    </div>
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
                    title={t('common.remove') || '移除'}
                    aria-label={t('common.remove') || '移除'}
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
              placeholder={reference ? '向 Git Agent 追问或直接按回车发送...' : isModelBlocked ? t('gitAgent.modelBlockedNotice') : t('gitAgent.inputPlaceholder')}
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
