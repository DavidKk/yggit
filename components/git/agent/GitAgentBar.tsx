'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuBot, LuPanelRight, LuSend, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Spinner, Tooltip } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { isModelAllowed } from '@/lib/agent/model-filter'
import { cn } from '@/lib/utils'

import { AgentQuickModelPopover } from './AgentQuickModelPopover'
import { FormattedMessage } from './AgentWorkspace'

interface Props {
  repoPath?: string
  className?: string
}

const FULL_LABEL = 'Git Agent'
const STORAGE_KEY = 'yggit.agent.bar-pos.v1'
export const THRESHOLD_DISTANCE = 180
export const SNAP_DISTANCE = 64

export function getPillDistance(pos: { x: number; y: number }): number {
  if (typeof window === 'undefined') return 0
  const defaultX = (window.innerWidth - 132) / 2
  const defaultY = window.innerHeight - 20 - 40
  return Math.hypot(pos.x - defaultX, pos.y - defaultY)
}

export function GitAgentBar({ repoPath, className }: Props) {
  const t = useT()
  const { sendMessage, isProcessing, messages, dockMode, setDockMode, config, modelFilter } = useAgent()

  const [input, setInput] = useState('')
  const isModelBlocked = !isModelAllowed(config.model, modelFilter)
  const [expanded, setExpanded] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [contentVisible, setContentVisible] = useState(false)
  const [quickCardOpen, setQuickCardOpen] = useState(false)

  // Drag state for collapsed mini pill (anchored to the Robot Icon handle)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSnapping, setIsSnapping] = useState(false)
  const [iconSlid, setIconSlid] = useState(false)
  const [vanishGhost, setVanishGhost] = useState<{ x: number; y: number } | null>(null)
  const [reappearGhost, setReappearGhost] = useState<{ x: number; y: number } | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const dragStartRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    clientX: number
    clientY: number
  } | null>(null)
  const hasMovedRef = useRef(false)
  const wasDraggingRef = useRef(false)
  const currentPosRef = useRef<{ x: number; y: number } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore saved dragged position from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const pillWidth = 132
          const pillHeight = 40
          const margin = 12
          const safeX = Math.max(margin, Math.min(window.innerWidth - pillWidth - margin, parsed.x))
          const safeY = Math.max(margin, Math.min(window.innerHeight - pillHeight - margin, parsed.y))
          setPosition({ x: safeX, y: safeY })
        }
      }
    } catch {}
  }, [])

  // Keep position clamped within window on resize
  useEffect(() => {
    function handleResize() {
      if (!position) return
      const pillWidth = 132
      const pillHeight = 40
      const margin = 12
      const maxX = Math.max(margin, window.innerWidth - pillWidth - margin)
      const maxY = Math.max(margin, window.innerHeight - pillHeight - margin)
      if (position.x > maxX || position.y > maxY) {
        setPosition({
          x: Math.max(margin, Math.min(maxX, position.x)),
          y: Math.max(margin, Math.min(maxY, position.y)),
        })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [position])

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current)
      snapTimerRef.current = null
    }
  }, [])

  const snapToDefaultCenter = useCallback(() => {
    if (!position || isSnapping || expanded || isClosing) return
    const defaultX = (window.innerWidth - 132) / 2
    const defaultY = window.innerHeight - 20 - 40
    setIsSnapping(true)
    setPosition({ x: defaultX, y: defaultY })
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    snapTimerRef.current = setTimeout(() => {
      setPosition(null)
      setIsSnapping(false)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }, 350)
  }, [position, isSnapping, expanded, isClosing])

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
    typewriterTimerRef.current = setTimeout(step, 140)
  }, [clearTypewriter])

  // Initial independent icon glide & typewriter effect on page load/mount
  useEffect(() => {
    const initTimer = setTimeout(() => {
      setIconSlid(true)
      startTypewriter()
    }, 350)
    return () => {
      clearTimeout(initTimer)
      clearTypewriter()
    }
  }, [startTypewriter, clearTypewriter])

  const openBar = useCallback(() => {
    if (expanded || isClosing || isSnapping) return
    clearTimers()
    clearTypewriter()
    setDisplayText('')
    setIconSlid(false)

    // Any custom position uses dual-pill vanish-expand animation
    if (position) {
      setVanishGhost({ x: position.x, y: position.y })
      setTimeout(() => {
        setVanishGhost(null)
      }, 400)
    }

    setExpanded(true)
    openTimerRef.current = setTimeout(() => {
      setContentVisible(true)
    }, 400)
  }, [clearTimers, clearTypewriter, position, expanded, isClosing, isSnapping])

  const closeBar = useCallback(() => {
    if (!expanded || isClosing) return
    clearTimers()
    clearTypewriter()

    setContentVisible(false)
    setDisplayText('')
    setIconSlid(false)

    // Any custom position uses dual-pill vanish-reappear animation
    if (position) {
      // Bottom bar vanishes symmetrically in-place at bottom center (same curve as mini pill)
      setIsClosing(true)
      // Remote mini pill simultaneously reappears at (position.x, position.y)
      setReappearGhost({ x: position.x, y: position.y })

      closeTimerRef.current = setTimeout(() => {
        setIsClosing(false)
        setExpanded(false)
        setReappearGhost(null)
        setIconSlid(true)
        startTypewriter()
      }, 400)
    } else {
      setExpanded(false)
      closeTimerRef.current = setTimeout(() => {
        setIconSlid(true)
        startTypewriter()
      }, 300)
    }
  }, [expanded, isClosing, clearTimers, clearTypewriter, startTypewriter, position])

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
      const element = target as Element
      if (isClosing) return
      if (element?.closest?.('[data-agent-popover], [data-base-ui-positioner], [data-base-ui-popup], [data-listbox-panel]')) {
        return
      }
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
  }, [expanded, quickCardOpen, input, isProcessing, closeBar, isClosing])

  // Auto-open quick card when processing starts if not docked
  useEffect(() => {
    if (isProcessing && dockMode === 'collapsed') {
      setQuickCardOpen(true)
    }
  }, [isProcessing, dockMode])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isProcessing || isModelBlocked) return

    setInput('')
    setQuickCardOpen(true)
    await sendMessage(trimmed, repoPath)
  }

  // Pointer drag event handlers specifically attached to the Robot Icon handle
  const handleIconPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (expanded || quickCardOpen || isSnapping) return
    if (e.button !== 0) return

    const rect = formRef.current?.getBoundingClientRect()
    if (!rect) return

    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: rect.left,
      startY: rect.top,
      clientX: e.clientX,
      clientY: e.clientY,
    }
    hasMovedRef.current = false
    wasDraggingRef.current = false

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handleIconPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.clientX
    const dy = e.clientY - dragStartRef.current.clientY

    if (!hasMovedRef.current && Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true
      wasDraggingRef.current = true
      setIsDragging(true)
    }

    if (hasMovedRef.current) {
      const pillWidth = 132
      const pillHeight = 40
      const margin = 12

      const nextX = Math.max(margin, Math.min(window.innerWidth - pillWidth - margin, dragStartRef.current.startX + dx))
      const nextY = Math.max(margin, Math.min(window.innerHeight - pillHeight - margin, dragStartRef.current.startY + dy))

      currentPosRef.current = { x: nextX, y: nextY }
      setPosition({ x: nextX, y: nextY })
    }
  }

  const handleIconPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}

    const moved = hasMovedRef.current
    dragStartRef.current = null
    hasMovedRef.current = false
    setIsDragging(false)

    if (moved) {
      setTimeout(() => {
        wasDraggingRef.current = false
      }, 100)

      // Snap back to default center with smooth animation if dropped near bottom-center
      const defaultX = (window.innerWidth - 132) / 2
      const defaultY = window.innerHeight - 20 - 40
      const droppedPos = currentPosRef.current || position
      currentPosRef.current = null
      const distToDefault = droppedPos ? Math.hypot(droppedPos.x - defaultX, droppedPos.y - defaultY) : Infinity

      if (droppedPos && distToDefault < SNAP_DISTANCE) {
        setIsSnapping(true)
        setPosition({ x: defaultX, y: defaultY })
        if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
        snapTimerRef.current = setTimeout(() => {
          setPosition(null)
          setIsSnapping(false)
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {}
        }, 350)
      } else if (droppedPos) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(droppedPos))
        } catch {}
      }
    }
  }

  const handleIconPointerCancel = () => {
    dragStartRef.current = null
    hasMovedRef.current = false
    currentPosRef.current = null
    setIsDragging(false)
    setTimeout(() => {
      wasDraggingRef.current = false
    }, 100)
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
            <Tooltip content={t('gitAgent.deepDiscussion')} placement="top">
              <button
                type="button"
                onClick={() => {
                  setQuickCardOpen(false)
                  setDockMode('dock-right')
                }}
                className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-panel hover:text-accent active:scale-95 transition-all cursor-pointer"
                aria-label={t('gitAgent.deepDiscussion')}
              >
                <LuPanelRight className="size-3.5 text-accent" />
              </button>
            </Tooltip>
            <span className="h-3 w-px bg-line/80 my-auto mx-0.5" aria-hidden="true" />
            <Tooltip content={t('common.close') || '关闭'} placement="top">
              <button
                type="button"
                onClick={() => {
                  setQuickCardOpen(false)
                  closeBar()
                }}
                className="flex size-6 items-center justify-center rounded text-ink-soft hover:bg-panel hover:text-ink active:scale-95 transition-all cursor-pointer"
                aria-label={t('common.close') || '关闭'}
              >
                <LuX className="size-3.5" />
              </button>
            </Tooltip>
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

          {/* Quick Model & Platform Popover */}
          <AgentQuickModelPopover />

          {/* Send Button */}
          <Tooltip content={isModelBlocked ? t('gitAgent.modelBlockedNotice') : t('gitAgent.send')} placement="top">
            <span className="inline-flex">
              <button
                type="submit"
                disabled={!input.trim() || isProcessing || isModelBlocked}
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full transition-all',
                  input.trim() && !isProcessing && !isModelBlocked
                    ? 'bg-accent text-accent-ink shadow-xs hover:brightness-110 active:scale-95 cursor-pointer'
                    : 'bg-[var(--overlay-06)] text-ink-soft/40 cursor-not-allowed opacity-50'
                )}
                aria-label={t('gitAgent.send')}
              >
                {isProcessing ? <Spinner className="size-3 text-accent" /> : <LuSend className="size-3.5" />}
              </button>
            </span>
          </Tooltip>
        </form>
      </div>
    )
  }

  const positionStyle: React.CSSProperties =
    !expanded && !isClosing && position
      ? {
          left: `${position.x}px`,
          top: `${position.y}px`,
          bottom: 'auto',
          transform: 'none',
        }
      : {
          left: '50%',
          bottom: '1.25rem',
          top: 'auto',
          transform: 'translateX(-50%)',
        }

  const formStyle: React.CSSProperties = {
    ...positionStyle,
    ...(expanded && position && !contentVisible && !isClosing
      ? {
          transformOrigin: 'center center',
          animation: 'bottom-bar-expand 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }
      : {}),
    ...(isClosing
      ? {
          transformOrigin: 'center center',
          animation: 'bottom-bar-vanish 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }
      : {}),
  }

  return (
    <>
      <style>{`
        @keyframes pill-vanish {
          0% {
            width: 132px;
            left: var(--ghost-x);
            transform: scale(1);
            opacity: 1;
          }
          40% {
            width: 49px;
            left: calc(var(--ghost-x) + 41.5px);
            transform: scale(1);
            opacity: 1;
          }
          55% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0.85);
            opacity: 1;
          }
          85% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0.2);
            opacity: 0.8;
          }
          100% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0);
            opacity: 0;
          }
        }

        @keyframes icon-scale-vanish {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
          55% {
            transform: scale(0.85);
            opacity: 1;
          }
          85% {
            transform: scale(0.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }

        @keyframes pill-reappear {
          0% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0);
            opacity: 0;
          }
          45% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(1);
            opacity: 1;
          }
          100% {
            width: 132px;
            left: var(--ghost-x);
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes icon-scale-reappear {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          45% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bottom-bar-expand {
          0% {
            width: 40px;
            transform: translateX(-50%) scale(0.7);
            opacity: 0.6;
          }
          30% {
            width: 40px;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          100% {
            width: min(90vw, 500px);
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
        }

        @keyframes bottom-bar-vanish {
          0% {
            width: min(90vw, 500px);
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          40% {
            width: 86px;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          55% {
            width: 40px;
            transform: translateX(-50%) scale(0.85);
            opacity: 1;
          }
          85% {
            width: 40px;
            transform: translateX(-50%) scale(0.2);
            opacity: 0.8;
          }
          100% {
            width: 40px;
            transform: translateX(-50%) scale(0);
            opacity: 0;
          }
        }
      `}</style>

      {/* Vanishing Pill at Remote Position (shrinks symmetrically to circle, with robot icon visibly scaling down to 0) */}
      {vanishGhost && (
        <div
          style={
            {
              '--ghost-x': `${vanishGhost.x}px`,
              top: `${vanishGhost.y}px`,
              transformOrigin: 'center center',
              animation: 'pill-vanish 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            } as React.CSSProperties
          }
          className="fixed z-40 flex h-10 items-center overflow-hidden rounded-full border border-accent bg-panel/90 shadow-md pointer-events-none pl-[5px]"
        >
          <div
            style={{
              transformOrigin: 'center center',
              animation: 'icon-scale-vanish 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-accent"
          >
            <LuBot className="size-4" />
          </div>
        </div>
      )}

      {/* Reappearing Pill at Remote Position (scales in as circle with icon, then expands symmetrically to 132px mini capsule) */}
      {reappearGhost && (
        <div
          style={
            {
              '--ghost-x': `${reappearGhost.x}px`,
              top: `${reappearGhost.y}px`,
              transformOrigin: 'center center',
              animation: 'pill-reappear 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            } as React.CSSProperties
          }
          className="fixed z-40 flex h-10 items-center overflow-hidden rounded-full border border-accent bg-panel/90 shadow-md pointer-events-none pl-[5px]"
        >
          <div
            style={{
              transformOrigin: 'center center',
              animation: 'icon-scale-reappear 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-accent"
          >
            <LuBot className="size-4" />
          </div>
        </div>
      )}

      <form
        ref={formRef}
        style={formStyle}
        onSubmit={handleSubmit}
        onClick={() => {
          if (wasDraggingRef.current) return
          if (!expanded) {
            openBar()
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (!expanded) return
            event.preventDefault()
            closeBar()
          }
        }}
        aria-label={t('gitAgent.barAria')}
        className={cn(
          'fixed z-40 flex h-10 items-center overflow-hidden rounded-full border border-accent bg-panel/90 shadow-lg backdrop-blur-md select-none',
          isDragging || isClosing
            ? 'transition-none'
            : isSnapping
              ? 'transition-[left,top,width,background-color,border-color,box-shadow,opacity] duration-350 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none'
              : 'transition-[width,background-color,border-color,box-shadow,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
          expanded || isClosing
            ? 'w-[min(90vw,500px)] px-[5px] opacity-100 focus-within:ring-2 focus-within:ring-accent/25'
            : 'w-[132px] pl-[5px] pr-2 cursor-pointer opacity-75 hover:opacity-100 hover:shadow-accent/20 hover:bg-panel active:scale-[0.99]',
          className
        )}
      >
        {/* Left Agent Robot Icon: Dedicated drag handle in collapsed mode; Close button in expanded mode */}
        <button
          type="button"
          tabIndex={expanded || isClosing ? 0 : -1}
          aria-expanded={expanded && !isClosing}
          aria-label={expanded ? t('common.close') || '收起' : t('gitAgent.barAria')}
          title={expanded ? t('common.close') : t('gitAgent.barDragHint')}
          onPointerDown={handleIconPointerDown}
          onPointerMove={handleIconPointerMove}
          onPointerUp={handleIconPointerUp}
          onPointerCancel={handleIconPointerCancel}
          onDoubleClick={(event) => {
            if (expanded || isClosing || isSnapping) return
            event.stopPropagation()
            snapToDefaultCenter()
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isClosing || isSnapping) return
            if (expanded) {
              closeBar()
            } else if (!wasDraggingRef.current) {
              openBar()
            }
          }}
          style={{
            transform: !expanded && !isClosing && !iconSlid ? 'translateX(46px)' : 'translateX(0px)',
            transition: isDragging ? 'none' : 'transform 500ms cubic-bezier(0.25, 1, 0.5, 1)',
            ...(isClosing
              ? {
                  transformOrigin: 'center center',
                  animation: 'icon-scale-vanish 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
                }
              : {}),
          }}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-accent outline-none',
            expanded || isClosing
              ? 'hover:bg-accent/15 cursor-pointer'
              : isDragging
                ? 'cursor-grabbing bg-accent/25 scale-105 shadow-xs'
                : 'cursor-grab hover:bg-accent/15 touch-none'
          )}
        >
          {isProcessing ? <Spinner className="size-3.5" /> : <LuBot className="size-4" />}
        </button>

        {/* Collapsed Label with Typewriter effect: fades in as icon glides independently */}
        {!expanded && (
          <span
            className={cn(
              'inline-flex items-center overflow-hidden text-[13px] font-medium tracking-wide text-ink whitespace-nowrap select-none ml-1.5',
              'transition-opacity duration-200 ease-out',
              displayText && iconSlid ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            {displayText}
          </span>
        )}

        {/* Expanded Content: Input & Actions */}
        <div
          className={cn(
            'flex items-center gap-1.5',
            expanded ? 'flex-1 min-w-0 ml-1.5' : 'w-0 max-w-0 overflow-hidden flex-none',
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

          {/* Quick Model & Platform Popover */}
          <AgentQuickModelPopover tabIndex={contentVisible ? 0 : -1} />

          {/* Send Button */}
          <Tooltip content={isModelBlocked ? t('gitAgent.modelBlockedNotice') : t('gitAgent.send')} placement="top">
            <span className="inline-flex">
              <button
                type="submit"
                disabled={!input.trim() || isProcessing || isModelBlocked}
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full transition-all',
                  input.trim() && !isProcessing && !isModelBlocked
                    ? 'bg-accent text-accent-ink shadow-xs hover:brightness-110 active:scale-95 cursor-pointer'
                    : 'bg-[var(--overlay-06)] text-ink-soft/40 cursor-not-allowed opacity-50'
                )}
                aria-label={t('gitAgent.send')}
                tabIndex={contentVisible ? 0 : -1}
              >
                {isProcessing ? <Spinner className="size-3 text-accent" /> : <LuSend className="size-3.5" />}
              </button>
            </span>
          </Tooltip>
        </div>
      </form>
    </>
  )
}
