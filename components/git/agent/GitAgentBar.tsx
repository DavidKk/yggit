'use client'

import React, { useEffect, useRef, useState } from 'react'
import { LuBot, LuExternalLink, LuSend, LuSettings, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Spinner } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { cn } from '@/lib/utils'

interface Props {
  repoPath?: string
  className?: string
}

export function GitAgentBar({ repoPath, className }: Props) {
  const t = useT()
  const { sendMessage, isProcessing, messages, setIsSettingsOpen, dockMode, setDockMode } = useAgent()

  const [input, setInput] = useState('')
  const [quickCardOpen, setQuickCardOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global hotkey: ⌘J / Ctrl+J
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-open quick card when processing starts if not docked
  useEffect(() => {
    if (isProcessing && dockMode === 'collapsed') {
      setQuickCardOpen(true)
    }
  }, [isProcessing, dockMode])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isProcessing) return

    setInput('')
    setQuickCardOpen(true)
    await sendMessage(trimmed, repoPath)
  }

  // Get the latest assistant response for the in-place answer card
  const lastAssistantMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'assistant')

  return (
    <>
      {/* 1. Floating In-Place Quick Answer Card */}
      {quickCardOpen && dockMode === 'collapsed' && lastAssistantMessage && (
        <div
          role="dialog"
          aria-label={t('gitAgent.quickAnswer')}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-[560px] rounded-xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <LuSparkles className="h-4 w-4 text-accent" />
              <span>{t('gitAgent.quickAnswer')}</span>
              {isProcessing && <Spinner className="h-3 w-3 ml-1" />}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setQuickCardOpen(false)
                  setDockMode('dock-right')
                }}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground active:scale-95 transition-all"
                title={t('gitAgent.deepDiscussion')}
              >
                <LuExternalLink className="h-3.5 w-3.5" />
                <span>{t('gitAgent.deepDiscussion')}</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickCardOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                aria-label="Close"
              >
                <LuX className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-60 overflow-y-auto text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text">
            {lastAssistantMessage.content || (isProcessing ? 'Agent 正在分析 Git 图谱与提交记录...' : '')}
          </div>
        </div>
      )}

      {/* 2. Bottom-Centered Pill Bar */}
      <form
        onSubmit={handleSubmit}
        aria-label={t('gitAgent.barAria')}
        className={cn(
          'fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex h-[44px] w-[90vw] max-w-[620px] items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 py-1.5 shadow-xl backdrop-blur-md transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30',
          className
        )}
      >
        {/* Left Agent Icon */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <LuBot className="h-4 w-4" />
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('gitAgent.barPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />

        {/* Shortcut Badge */}
        {!input && (
          <kbd className="hidden sm:inline-flex items-center rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">⌘J</kbd>
        )}

        {/* Settings Gear Button */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground active:scale-95 transition-all"
          title={t('gitAgent.settingsTitle')}
          aria-label={t('gitAgent.settingsTitle')}
        >
          <LuSettings className="h-4 w-4" />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all active:scale-95',
            input.trim() && !isProcessing ? 'bg-accent text-accent-foreground shadow-sm hover:brightness-110' : 'text-muted-foreground/40 cursor-not-allowed'
          )}
          aria-label="Send query"
        >
          {isProcessing ? <Spinner className="h-3.5 w-3.5" /> : <LuSend className="h-3.5 w-3.5" />}
        </button>
      </form>
    </>
  )
}
