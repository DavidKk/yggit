'use client'

import Link from 'next/link'
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
  const { sendMessage, isProcessing, messages, dockMode, setDockMode } = useAgent()

  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [quickCardOpen, setQuickCardOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    }
  }, [expanded])

  // Global hotkey: ⌘J / Ctrl+J
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        setExpanded((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside to collapse if empty
  useEffect(() => {
    if (!expanded) return
    function handleClickOutside(event: PointerEvent) {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        if (!input.trim()) {
          setExpanded(false)
        }
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [expanded, input])

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

  const collapse = () => {
    setExpanded(false)
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
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-[560px] rounded-xl border border-line bg-panel/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
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
            setExpanded(true)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            collapse()
          }
        }}
        aria-label={t('gitAgent.barAria')}
        className={cn(
          'fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex h-10 items-center overflow-hidden rounded-full border border-accent bg-panel/90 shadow-lg backdrop-blur-md transition-[width,padding,background-color,border-color,box-shadow] duration-350 ease-[cubic-bezier(0.175,0.885,0.32,1.15)] motion-reduce:transition-none select-none',
          expanded
            ? 'w-[min(90vw,500px)] px-3 focus-within:ring-2 focus-within:ring-accent/25'
            : 'w-[128px] px-3.5 cursor-pointer hover:shadow-accent/15 hover:bg-panel active:scale-[0.98]',
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
              collapse()
            }
          }}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-accent outline-none transition-colors duration-200',
            expanded ? 'hover:bg-accent/15 cursor-pointer' : 'pointer-events-none'
          )}
        >
          {isProcessing ? <Spinner className="size-3.5" /> : <LuBot className="size-4" />}
        </button>

        {/* Collapsed Label: "Git Agent" */}
        <span
          className={cn(
            'text-[13px] font-medium tracking-wide text-ink whitespace-nowrap overflow-hidden transition-[max-width,opacity,margin] duration-300 ease-out select-none',
            expanded ? 'max-w-0 opacity-0 ml-0 pointer-events-none' : 'max-w-[80px] opacity-100 ml-2'
          )}
        >
          Git Agent
        </span>

        {/* Expanded Content: Input & Actions */}
        <div
          className={cn(
            'flex flex-1 min-w-0 items-center gap-1.5 transition-[opacity,transform] duration-300 ease-out',
            expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('gitAgent.barPlaceholder')}
            className="min-w-0 flex-1 bg-transparent px-1 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none"
            tabIndex={expanded ? 0 : -1}
          />

          {!input.trim() && (
            <kbd className="hidden sm:inline-flex items-center rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft select-none">⌘J</kbd>
          )}

          {/* Settings Link */}
          <Link
            href={repoPath ? `/settings?repo=${encodeURIComponent(repoPath)}` : '/settings'}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all"
            title={t('gitAgent.settingsTitle')}
            aria-label={t('gitAgent.settingsTitle')}
            tabIndex={expanded ? 0 : -1}
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
              tabIndex={expanded ? 0 : -1}
            >
              {isProcessing ? <Spinner className="size-3" /> : <LuSend className="size-3.5" />}
            </button>
          ) : null}

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              collapse()
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink active:scale-95 transition-all cursor-pointer"
            aria-label="Collapse"
            title={t('common.close') || '收起'}
            tabIndex={expanded ? 0 : -1}
          >
            <LuX className="size-3.5" />
          </button>
        </div>
      </form>
    </>
  )
}
