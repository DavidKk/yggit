'use client'

import React, { useEffect, useRef, useState } from 'react'
import { LuBot, LuCheck, LuCopy, LuMaximize2, LuMinimize2, LuSend, LuSparkles, LuTrash2, LuUser, LuWrench, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

interface Props {
  repoPath?: string
  className?: string
}

export function AgentWorkspace({ repoPath, className }: Props) {
  const t = useT()
  const { dockMode, setDockMode, messages, sendMessage, clearMessages, isProcessing } = useAgent()

  const [input, setInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (dockMode === 'collapsed') return null

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isProcessing) return
    setInput('')
    await sendMessage(trimmed, repoPath)
  }

  const handleCopy = (id: string, text: string) => {
    copyToClipboard(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const isDockRight = dockMode === 'dock-right'

  return (
    <aside
      role="region"
      aria-label={t('gitAgent.dockTitle')}
      className={cn(
        'z-30 flex flex-col border-border/80 bg-background/95 backdrop-blur-md shadow-2xl transition-all duration-200',
        isDockRight ? 'fixed top-12 right-0 bottom-0 w-[420px] max-w-full border-l' : 'fixed right-0 bottom-0 left-0 h-[360px] border-t',
        className
      )}
    >
      {/* Workspace Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-4 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent">
            <LuSparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">{t('gitAgent.dockTitle')}</span>
          {isProcessing && (
            <div className="flex items-center gap-1 text-[11px] text-accent">
              <Spinner className="h-3 w-3" />
              <span>分析中...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Dock Layout Switcher */}
          <button
            type="button"
            onClick={() => setDockMode(isDockRight ? 'dock-bottom' : 'dock-right')}
            className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            title={isDockRight ? t('gitAgent.dockBottom') : t('gitAgent.dockRight')}
            aria-label="Toggle layout"
          >
            {isDockRight ? <LuMinimize2 className="h-4 w-4" /> : <LuMaximize2 className="h-4 w-4" />}
          </button>

          {/* Clear Messages */}
          <button
            type="button"
            onClick={clearMessages}
            className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            title={t('gitAgent.clearHistory')}
            aria-label={t('gitAgent.clearHistory')}
          >
            <LuTrash2 className="h-4 w-4" />
          </button>

          {/* Close Dock */}
          <button
            type="button"
            onClick={() => setDockMode('collapsed')}
            className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            title={t('gitAgent.dockClose')}
            aria-label={t('gitAgent.dockClose')}
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <LuBot className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs font-medium">您可以向 Git Agent 询问任何提交历史、分支合入或影响范围诊断。</p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-xs mt-2">
              {['验证当前分支有没有合入 TEST 分支', '查询今日 merge 清单', '查看某作者最近提交'].map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInput(prompt)
                  }}
                  className="rounded border border-border/60 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground hover:border-accent hover:text-accent transition-all cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user'
            const isTool = m.role === 'tool'

            if (isTool) {
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-1.5 text-[11px] text-muted-foreground">
                  <LuWrench className="h-3 w-3 text-accent" />
                  <span>
                    已调用工具：<code className="font-mono text-accent">{m.name}</code>
                  </span>
                </div>
              )
            }

            return (
              <div key={m.id} className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                  {isUser ? (
                    <>
                      <span>You</span>
                      <LuUser className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      <LuBot className="h-3 w-3 text-accent" />
                      <span>Git Agent</span>
                    </>
                  )}
                </div>

                <div
                  className={cn(
                    'group relative max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed select-text shadow-xs',
                    isUser ? 'bg-accent text-accent-foreground rounded-tr-none' : 'bg-muted/30 border border-border/60 text-foreground rounded-tl-none'
                  )}
                >
                  <div className="whitespace-pre-wrap">{m.content || (m.isStreaming ? 'Thinking...' : '')}</div>

                  {!isUser && m.content && (
                    <button
                      type="button"
                      onClick={() => handleCopy(m.id, m.content)}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-muted-foreground hover:text-foreground"
                      title="复制回答"
                    >
                      {copiedId === m.id ? <LuCheck className="h-3 w-3 text-emerald-500" /> : <LuCopy className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border/50 p-3 bg-muted/10">
        <TextInput fullWidth value={input} onChange={(e) => setInput(e.target.value)} placeholder="深入追问 Git 历史或排查线索..." />
        <Button type="submit" variant="default" size="icon" disabled={!input.trim() || isProcessing} aria-label="Send message">
          {isProcessing ? <Spinner className="h-3.5 w-3.5" /> : <LuSend className="h-3.5 w-3.5" />}
        </Button>
      </form>
    </aside>
  )
}
