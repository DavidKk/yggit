'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuBot,
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuClock,
  LuCopy,
  LuFileText,
  LuFolderGit2,
  LuGitBranch,
  LuGitMerge,
  LuMaximize2,
  LuMinimize2,
  LuSearch,
  LuSend,
  LuSparkles,
  LuTrash2,
  LuUser,
  LuWrench,
  LuX,
} from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { copyToClipboard } from '@/lib/clipboard'
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

const QUICK_ACTIONS = [
  { label: '分支统计', prompt: '当前分支有多少个？请统计分支数量，并列出本地与远程分支。', icon: <LuGitBranch className="size-3" /> },
  { label: '仓库状态', prompt: '当前在哪个分支？最新的一次 Commit 是什么？', icon: <LuFolderGit2 className="size-3" /> },
  { label: '合入检测', prompt: '验证当前分支有没有合入 master 分支，是否存在未合入或污染提交？', icon: <LuGitMerge className="size-3" /> },
  { label: '今日 Merge', prompt: '查询今日的所有 Merge 提交记录与改动说明', icon: <LuClock className="size-3" /> },
  { label: '提交搜索', prompt: '搜索最近 3 天内的提交记录，按时间排序', icon: <LuSearch className="size-3" /> },
]

export function AgentWorkspace({ repoPath, className }: Props) {
  const t = useT()
  const { dockMode, setDockMode, messages, sendMessage, clearMessages, isProcessing, activeRepo } = useAgent()

  const [input, setInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCapabilities, setShowCapabilities] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const effectiveRepo = repoPath || activeRepo || ''

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim()
      if (!trimmed || isProcessing) return
      setInput('')
      setShowCapabilities(false)
      await sendMessage(trimmed, effectiveRepo)
    },
    [isProcessing, sendMessage, effectiveRepo]
  )

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    await handleSendPrompt(input)
  }

  const handleCopy = (id: string, text: string) => {
    void copyToClipboard(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (dockMode === 'collapsed') return null

  const isDockRight = dockMode === 'dock-right'

  return (
    <aside
      role="region"
      aria-label={t('gitAgent.dockTitle')}
      className={cn(
        'z-20 flex flex-col border-line bg-panel shrink-0 transition-all duration-200 overflow-hidden',
        isDockRight ? 'w-[440px] max-w-full h-full border-l shadow-2xl' : 'h-[360px] max-h-full w-full border-t shadow-2xl',
        className
      )}
    >
      {/* Workspace Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 bg-panel-2/70 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <LuSparkles className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-ink truncate">{t('gitAgent.dockTitle')}</span>
          {isProcessing ? (
            <div className="flex items-center gap-1 text-[11px] text-accent shrink-0 font-medium">
              <Spinner className="size-3" />
              <span>{t('gitAgent.analyzing')}</span>
            </div>
          ) : effectiveRepo ? (
            <span className="text-[11px] text-ink-soft truncate max-w-[140px]" title={effectiveRepo}>
              · {effectiveRepo.split('/').pop() || effectiveRepo}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Quick Capabilities Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowCapabilities((prev) => !prev)}
            className={cn(
              'rounded px-1.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer',
              showCapabilities ? 'bg-accent/15 text-accent' : 'text-ink-soft hover:bg-[var(--overlay-08)] hover:text-ink'
            )}
            title={t('gitAgent.capabilitiesTitle')}
          >
            <LuWrench className="size-3" />
            <span>{t('gitAgent.capabilitiesButton')}</span>
            {showCapabilities ? <LuChevronUp className="size-3" /> : <LuChevronDown className="size-3" />}
          </button>

          {/* Dock Layout Switcher */}
          <button
            type="button"
            onClick={() => setDockMode(isDockRight ? 'dock-bottom' : 'dock-right')}
            className="rounded p-1.5 text-ink-soft hover:bg-[var(--overlay-08)] hover:text-ink transition-colors cursor-pointer"
            title={isDockRight ? t('gitAgent.dockBottom') : t('gitAgent.dockRight')}
            aria-label="Toggle layout"
          >
            {isDockRight ? <LuMinimize2 className="size-3.5" /> : <LuMaximize2 className="size-3.5" />}
          </button>

          {/* Clear Messages */}
          <button
            type="button"
            onClick={clearMessages}
            className="rounded p-1.5 text-ink-soft hover:bg-[var(--overlay-08)] hover:text-ink transition-colors cursor-pointer"
            title={t('gitAgent.clearHistory')}
            aria-label={t('gitAgent.clearHistory')}
          >
            <LuTrash2 className="size-3.5" />
          </button>

          {/* Close Dock */}
          <button
            type="button"
            onClick={() => setDockMode('collapsed')}
            className="rounded p-1.5 text-ink-soft hover:bg-[var(--overlay-08)] hover:text-ink transition-colors cursor-pointer"
            title={t('gitAgent.dockClose')}
            aria-label={t('gitAgent.dockClose')}
          >
            <LuX className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Capabilities Drawer */}
      {showCapabilities ? (
        <div className="border-b border-line bg-panel-2/95 p-3 space-y-2 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">{t('gitAgent.capabilitiesTitle')}</span>
            <span className="text-[11px] text-ink-soft">{t('gitAgent.capabilitiesHint')}</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon
              return (
                <button
                  key={cap.id}
                  type="button"
                  onClick={() => handleSendPrompt(cap.prompt)}
                  className="flex flex-col gap-0.5 rounded border border-line/80 bg-panel p-2 text-left hover:border-accent hover:bg-[var(--overlay-04)] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-ink group-hover:text-accent">
                    <Icon className="size-3.5 shrink-0 text-accent" />
                    <span className="truncate">{cap.title}</span>
                  </div>
                  <span className="text-[11px] text-ink-soft leading-tight line-clamp-1">{cap.description}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

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
          messages.map((m) => {
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
                      <span>{t('gitAgent.analyzingLog')}</span>
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
        {/* Quick Action Chips Bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={isProcessing}
              onClick={() => handleSendPrompt(action.prompt)}
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] text-ink-soft hover:border-accent hover:text-accent transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Input Shell */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            disabled={isProcessing}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('gitAgent.inputPlaceholder')}
            className="flex-1 min-w-0 h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink placeholder:text-ink-soft/60 outline-none focus:border-accent transition-colors"
          />
          <Button type="submit" variant="accent" size="icon" disabled={!input.trim() || isProcessing} aria-label="Send message" className="shrink-0">
            {isProcessing ? <Spinner className="size-3.5" /> : <LuSend className="size-3.5" />}
          </Button>
        </div>
      </form>
    </aside>
  )
}

/** Formats LLM responses with simple markdown parsing for readability. */
function FormattedMessage({ content }: { content: string }) {
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
