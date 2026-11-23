'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuBot,
  LuCheck,
  LuClock,
  LuCopy,
  LuFileText,
  LuFolderGit2,
  LuGitBranch,
  LuGitMerge,
  LuGitPullRequest,
  LuSearch,
  LuSend,
  LuSettings,
  LuShieldAlert,
  LuSparkles,
  LuTrash2,
  LuUser,
  LuWrench,
  LuX,
} from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner, Tooltip } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import type { AgentOpenEventDetail, AgentReference } from '@/lib/agent/agent-quote'
import { isModelAllowed } from '@/lib/agent/model-filter'
import { getAgentProcessingStatus } from '@/lib/agent/status-helper'
import { copyToClipboard } from '@/lib/clipboard'
import { saveLastGitUrl } from '@/lib/git/last-git-url'
import { cn } from '@/lib/utils'

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

export function AgentWorkspace({ repoPath, className }: Props) {
  const t = useT()
  const { dockMode, setDockMode, messages, sendMessage, clearMessages, isProcessing, activeRepo, config, modelFilter } = useAgent()

  const [input, setInput] = useState('')
  const [reference, setReference] = useState<AgentReference | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  if (dockMode === 'collapsed') return null

  return (
    <aside
      data-agent-sidebar=""
      role="region"
      aria-label={t('gitAgent.dockTitle')}
      className={cn(
        'z-20 flex flex-col border-l border-line bg-panel shrink-0 transition-all duration-200 overflow-hidden w-[440px] max-w-full h-full shadow-2xl animate-in fade-in slide-in-from-right duration-200',
        className
      )}
    >
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

          {/* Settings */}
          <Tooltip content={t('gitAgent.settingsTitle')} placement="bottom">
            <Link
              href="/settings/models"
              onClick={() => {
                if (typeof window !== 'undefined' && window.location.pathname.startsWith('/git')) {
                  saveLastGitUrl(window.location.pathname + window.location.search)
                }
              }}
              className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer"
              aria-label={t('gitAgent.settingsTitle')}
            >
              <LuSettings className="size-3.5" />
            </Link>
          </Tooltip>

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
              return (
                <div key={m.id} className="flex items-center gap-2 rounded border border-line bg-panel-2/50 px-2.5 py-1.5 text-[11px] text-ink-soft">
                  <LuWrench className="size-3 text-accent shrink-0" />
                  <span>
                    {t('gitAgent.executedTool')}
                    <code className="font-mono text-accent font-medium">{m.name}</code>
                  </span>
                </div>
              )
            }

            // Do not render empty assistant bubble (e.g. intermediate turn with tool calls)
            if (!isUser && !m.content?.trim() && !m.isStreaming) {
              return null
            }

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
                      <LuBot className="size-3 text-accent" />
                      <span className="font-medium text-ink">Git Agent</span>
                    </>
                  )}
                </div>

                <div
                  className={cn(
                    'group relative max-w-[90%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed select-text shadow-xs break-words',
                    isUser ? 'bg-accent text-white rounded-tr-xs' : 'bg-panel-2 border border-line text-ink rounded-tl-xs'
                  )}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : m.content ? (
                    <FormattedMessage content={m.content} />
                  ) : m.isStreaming ? (
                    <div className="flex items-center gap-1.5 text-ink-soft py-0.5">
                      <Spinner className="size-3 text-accent shrink-0" />
                      <span>
                        {getAgentProcessingStatus(
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
      <form onSubmit={handleSend} className="border-t border-line p-2.5 bg-panel-2/40 flex flex-col gap-1.5">
        {isModelBlocked && (
          <div className="flex items-center gap-1.5 rounded border border-fail/30 bg-fail/10 px-2 py-1 text-[11px] text-fail font-medium">
            <LuShieldAlert className="size-3.5 shrink-0" />
            <span>{t('gitAgent.modelBlockedNotice')}</span>
          </div>
        )}

        {/* Reference Citation Badge */}
        {reference && (
          <div className="flex items-center">
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

        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            disabled={isProcessing || isModelBlocked}
            onChange={(e) => setInput(e.target.value)}
            placeholder={reference ? '向 Git Agent 追问或直接按回车发送...' : isModelBlocked ? t('gitAgent.modelBlockedNotice') : t('gitAgent.inputPlaceholder')}
            className="flex-1 min-w-0 h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink placeholder:text-ink-soft/60 outline-none focus:border-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <Tooltip content={isModelBlocked ? t('gitAgent.modelBlockedNotice') : 'Send message'}>
            <span className="inline-flex shrink-0">
              <Button type="submit" variant="accent" size="icon" disabled={(!input.trim() && !reference) || isProcessing || isModelBlocked} aria-label="Send message">
                {isProcessing ? <Spinner className="size-3.5" /> : <LuSend className="size-3.5" />}
              </Button>
            </span>
          </Tooltip>
        </div>
      </form>
    </aside>
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
