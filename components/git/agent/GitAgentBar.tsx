'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuBot, LuPanelRight, LuSend, LuSettings, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Spinner } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { cn } from '@/lib/utils'

import { FormattedMessage } from './AgentWorkspace'

interface Props {
  repoPath?: string
  className?: string
}

const FULL_LABEL = 'Git Agent'

export function GitAgentBar({ repoPath, className }: Props) {
  const t = useT()
  const { sendMessage, isProcessing, messages, dockMode, setDockMode } = useAgent()

  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [contentVisible, setContentVisible] = useState(false)
  const [quickCardOpen, setQuickCardOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const clearTypewriter = useCallback(() => {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current)
      typewriterTimerRef.current = null
    }
  }, [])

  const startTypewriter = useCallback(() => {
    clearTypewriter()
    setDisplayText('')
    let idx = 0
    const step = () => {
      idx += 1
      setDisplayText(FULL_LABEL.slice(0, idx))
      if (idx < FULL_LABEL.length) {
        typewriterTimerRef.current = setTimeout(step, 40)
      }
    }
    typewriterTimerRef.current = setTimeout(step, 60)
  }, [clearTypewriter])

  // Initial typewriter effect on page load/mount
  useEffect(() => {
    const initTimer = setTimeout(() => {
      startTypewriter()
    }, 280)
    return () => {
      clearTimeout(initTimer)
      clearTypewriter()
    }
  }, [startTypewriter, clearTypewriter])

  const openBar = useCallback(() => {
    clearTimers()
    clearTypewriter()
    // Staged sequence: 1. Hide text immediately so pill stretches cleanly
    setDisplayText('')
    // 2. Expand container width with spring curve
    setExpanded(true)
    // 3. Staged: reveal expanded input & actions only after width stretch settles
    openTimerRef.current = setTimeout(() => {
      setContentVisible(true)
    }, 280)
  }, [clearTimers, clearTypewriter])

  const closeBar = useCallback(() => {
    clearTimers()
    clearTypewriter()
    // Staged sequence: 1. Hide expanded content immediately
    setContentVisible(false)
    // 2. Collapse container width with spring recoil; text is empty so icon stays centered
    setExpanded(false)
    setDisplayText('')
    // 3. Staged: start typewriter to glide icon leftward only after container bounce settles
    closeTimerRef.current = setTimeout(() => {
      startTypewriter()
    }, 360)
  }, [clearTimers, clearTypewriter, startTypewriter])

  const toggleBar = useCallback(() => {
    if (quickCardOpen) {
      setQuickCardOpen(false)
      closeBar()
    } else if (expanded) {
      closeBar()
    } else {
      openBar()
    }
  }, [quickCardOpen, expanded, closeBar, openBar])

  useEffect(() => {
    return () => {
      clearTimers()
      clearTypewriter()
    }
  }, [clearTimers, clearTypewriter])

  useEffect(() => {
    if (contentVisible) {
      inputRef.current?.focus()
    }
  }, [contentVisible])

  // Global hotkey: ⌘J / Ctrl+J
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        toggleBar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleBar])

  // Click outside to collapse if empty
  useEffect(() => {
    if (!expanded && !quickCardOpen) return
    function handleClickOutside(event: PointerEvent) {
      const target = event.target as Node
      const isInsideForm = formRef.current?.contains(target)
      const isInsideCard = containerRef.current?.contains(target)

      if (!isInsideForm && !isInsideCard) {
        if (!input.trim() && !isProcessing) {
          if (quickCardOpen) {
            setQuickCardOpen(false)
          }
          closeBar()
        }
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [expanded, quickCardOpen, input, isProcessing, closeBar])

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

  if (dockMode !== 'collapsed') return null

  // Get the latest assistant response for the in-place answer card
  const lastAssistantMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'assistant')

  const hasCard = quickCardOpen && Boolean(lastAssistantMessage)

  if (hasCard) {
    return (
      <div
        ref={containerRef}
        role="dialog"
        aria-label={t('gitAgent.quickAnswer')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setQuickCardOpen(false)
            closeBar()
          }
        }}
        className={cn(
          'fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex w-[min(92vw,560px)] flex-col overflow-hidden rounded-2xl border border-line bg-panel/95 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 select-none',
          className
        )}
      >
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line/60 px-3.5 bg-panel-2/50 select-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
            <LuSparkles className="size-3.5 text-accent" />
            <span>{t('gitAgent.quickAnswer')}</span>
            {isProcessing && <Spinner className="size-3 ml-1" />}
          </div>

          {/* Unified Header Control Pill */}
          <div className="flex items-center rounded-lg border border-line bg-panel-2/70 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setQuickCardOpen(false)
                setDockMode('dock-right')
              }}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium text-ink-soft hover:bg-panel hover:text-accent active:scale-95 transition-all cursor-pointer"
              title={t('gitAgent.deepDiscussion')}
            >
              <LuPanelRight className="size-3.5 text-accent" />
              <span>{t('gitAgent.deepDiscussion')}</span>
            </button>
            <span className="h-3.5 w-px bg-line/80 my-auto mx-0.5" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                setQuickCardOpen(false)
                closeBar()
              }}
              className="rounded p-1 text-ink-soft hover:bg-panel hover:text-ink active:scale-95 transition-all cursor-pointer"
              title={t('common.close') || '关闭'}
              aria-label="Close"
            >
              <LuX className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="max-h-60 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-ink select-text">
          {lastAssistantMessage?.content ? (
            <FormattedMessage content={lastAssistantMessage.content} />
          ) : isProcessing ? (
            <div className="flex items-center gap-1.5 text-ink-soft py-1">
              <Spinner className="size-3 text-accent shrink-0" />
              <span>{t('gitAgent.analyzingLog')}</span>
            </div>
          ) : null}
        </div>

        {/* Integrated Bottom Input Row */}
        <form onSubmit={handleSubmit} className="flex h-11 shrink-0 items-center gap-2 border-t border-line/60 px-3 bg-panel-2/30">
          <div className="flex size-6 shrink-0 items-center justify-center text-accent">{isProcessing ? <Spinner className="size-3.5" /> : <LuBot className="size-4" />}</div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('gitAgent.barPlaceholder')}
            className="min-w-0 flex-1 bg-transparent px-1 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none"
          />

          {/* Settings Link */}
          <Link
            href="/settings"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all"
            title={t('gitAgent.settingsTitle')}
            aria-label={t('gitAgent.settingsTitle')}
          >
            <LuSettings className="size-3.5" />
          </Link>

          {/* Send Button */}
          {input.trim() ? (
            <button
              type="submit"
              disabled={isProcessing}
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              aria-label="Send query"
            >
              {isProcessing ? <Spinner className="size-3" /> : <LuSend className="size-3.5" />}
            </button>
          ) : null}
        </form>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onClick={() => {
        if (!expanded) {
          openBar()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          closeBar()
        }
      }}
      aria-label={t('gitAgent.barAria')}
      className={cn(
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex h-10 items-center overflow-hidden rounded-full border border-accent bg-panel/90 shadow-lg backdrop-blur-md transition-[width,padding,background-color,border-color,box-shadow,opacity] duration-350 ease-[cubic-bezier(0.175,0.885,0.32,1.15)] motion-reduce:transition-none select-none',
        expanded
          ? 'w-[min(90vw,500px)] px-3 opacity-100 focus-within:ring-2 focus-within:ring-accent/25'
          : 'w-[128px] justify-center px-3.5 cursor-pointer opacity-70 hover:opacity-100 hover:shadow-accent/20 hover:bg-panel active:scale-[0.98]',
        className
      )}
    >
      {/* Left Agent Robot Icon */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t('gitAgent.barAria')}
        title={expanded ? t('common.close') || '收起' : t('gitAgent.barAria')}
        onClick={(e) => {
          if (expanded) {
            e.stopPropagation()
            closeBar()
          }
        }}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full text-accent outline-none transition-colors duration-200',
          expanded ? 'hover:bg-accent/15 cursor-pointer' : 'pointer-events-none'
        )}
      >
        {isProcessing ? <Spinner className="size-3.5" /> : <LuBot className="size-4" />}
      </button>

      {/* Collapsed Label with Typewriter effect */}
      {!expanded && displayText ? <span className="text-[13px] font-medium tracking-wide text-ink whitespace-nowrap overflow-hidden select-none ml-2">{displayText}</span> : null}

      {/* Expanded Content: Input & Actions */}
      <div
        className={cn(
          'flex items-center gap-1.5',
          expanded ? 'flex-1 min-w-0' : 'w-0 max-w-0 overflow-hidden flex-none',
          contentVisible
            ? 'opacity-100 translate-x-0 transition-[opacity,transform] duration-200 ease-out'
            : 'opacity-0 -translate-x-2 pointer-events-none transition-[opacity,transform] duration-150 ease-in'
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('gitAgent.barPlaceholder')}
          className="min-w-0 flex-1 bg-transparent px-1 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none"
          tabIndex={contentVisible ? 0 : -1}
        />

        {/* Settings Link */}
        <Link
          href="/settings"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all"
          title={t('gitAgent.settingsTitle')}
          aria-label={t('gitAgent.settingsTitle')}
          tabIndex={contentVisible ? 0 : -1}
        >
          <LuSettings className="size-3.5" />
        </Link>

        {/* Send Button */}
        {input.trim() ? (
          <button
            type="submit"
            disabled={isProcessing}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            aria-label="Send query"
            tabIndex={contentVisible ? 0 : -1}
          >
            {isProcessing ? <Spinner className="size-3" /> : <LuSend className="size-3.5" />}
          </button>
        ) : null}
      </div>
    </form>
  )
}
