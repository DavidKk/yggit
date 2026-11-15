'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuBot, LuExternalLink, LuSend, LuSettings, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Spinner } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { cn } from '@/lib/utils'

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
    if (expanded) {
      closeBar()
    } else {
      openBar()
    }
  }, [expanded, closeBar, openBar])

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
    if (!expanded) return
    function handleClickOutside(event: PointerEvent) {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        if (!input.trim()) {
          closeBar()
        }
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [expanded, input, closeBar])

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
      {/* 1. In-Place Quick Answer Card */}
      {quickCardOpen && dockMode === 'collapsed' && lastAssistantMessage && (
        <div
          role="dialog"
          aria-label={t('gitAgent.quickAnswer')}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-[560px] rounded-xl border border-line bg-panel/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line/60 pb-2.5 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <LuSparkles className="size-4 text-accent" />
              <span>{t('gitAgent.quickAnswer')}</span>
              {isProcessing && <Spinner className="size-3 ml-1" />}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setQuickCardOpen(false)
                  setDockMode('dock-right')
                }}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer"
                title={t('gitAgent.deepDiscussion')}
              >
                <LuExternalLink className="size-3.5" />
                <span>{t('gitAgent.deepDiscussion')}</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickCardOpen(false)}
                className="rounded p-1 text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink cursor-pointer"
                aria-label="Close"
              >
                <LuX className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-60 overflow-y-auto text-xs leading-relaxed text-ink whitespace-pre-wrap select-text">
            {lastAssistantMessage.content || (isProcessing ? 'Agent 正在分析 Git 图谱与提交记录...' : '')}
          </div>
        </div>
      )}

      {/* 2. Bottom-Centered Pill Bar */}
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

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeBar()
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer"
            aria-label="Collapse"
            title={t('common.close') || '收起'}
            tabIndex={contentVisible ? 0 : -1}
          >
            <LuX className="size-3.5" />
          </button>
        </div>
      </form>
    </>
  )
}
