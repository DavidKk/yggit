'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuBot, LuSend, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Spinner, Tooltip } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { type AgentOpenEventDetail, type AgentReference, isAgentSidebarOpen } from '@/lib/agent/agent-quote'
import { isModelAllowed } from '@/lib/agent/model-filter'
import { cn } from '@/lib/utils'

import { AgentQuickModelPopover } from './AgentQuickModelPopover'
import { GitAgentAssistiveReminder } from './GitAgentAssistiveReminder'
import { GitAgentBarGhosts } from './GitAgentBarGhosts'
import { GitAgentQuickCard } from './GitAgentQuickCard'

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
  const { sendMessage, retryMessage, isProcessing, messages, dockMode, setDockMode, config, modelFilter } = useAgent()

  const [input, setInput] = useState('')
  const [reference, setReference] = useState<AgentReference | null>(null)
  const isModelBlocked = !isModelAllowed(config.model, modelFilter)
  const [expanded, setExpanded] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [contentVisible, setContentVisible] = useState(false)
  const [quickCardOpen, setQuickCardOpen] = useState(false)
  const [isCollapsingCard, setIsCollapsingCard] = useState(false)
  const collapseCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get the latest assistant and user messages
  const lastAssistantMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'assistant')

  const lastUserMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'user')

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

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<AgentOpenEventDetail>).detail
      // If sidebar is targeted or sidebar is currently open, do not handle in bottom bar
      if (detail?.target === 'sidebar' || dockMode !== 'collapsed' || isAgentSidebarOpen()) return

      openBar()
      if (detail?.reference) {
        setReference(detail.reference)
        setTimeout(() => {
          inputRef.current?.focus()
        }, 450)
      } else if (detail?.prompt) {
        setInput(detail.prompt)
        setTimeout(() => {
          inputRef.current?.focus()
        }, 450)
      }
    }
    window.addEventListener('yggit:agent_open', handleOpen)
    return () => window.removeEventListener('yggit:agent_open', handleOpen)
  }, [openBar, dockMode])

  const closeBar = useCallback(() => {
    if (isClosing) return
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
  }, [isClosing, clearTimers, clearTypewriter, startTypewriter, position])

  // Downward compression animation from Quick Answer Card into bottom pill
  const handleCollapseCard = useCallback(
    (mode: 'pill' | 'close') => {
      if (isCollapsingCard) return
      setIsCollapsingCard(true)

      collapseCardTimerRef.current = setTimeout(() => {
        setIsCollapsingCard(false)
        setQuickCardOpen(false)
        if (mode === 'close') {
          closeBar()
        } else {
          setExpanded(true)
          setContentVisible(true)
        }
      }, 280)
    },
    [isCollapsingCard, closeBar]
  )

  useEffect(() => {
    return () => {
      if (collapseCardTimerRef.current) {
        clearTimeout(collapseCardTimerRef.current)
      }
    }
  }, [])

  const toggleBar = useCallback(() => {
    if (quickCardOpen) {
      handleCollapseCard('close')
    } else if (expanded) {
      closeBar()
    } else {
      if (lastAssistantMessage) {
        setQuickCardOpen(true)
      } else {
        openBar()
      }
    }
  }, [quickCardOpen, expanded, handleCollapseCard, closeBar, openBar, lastAssistantMessage])

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
      if (isClosing || isCollapsingCard) return
      if (element?.closest?.('[data-agent-popover], [data-base-ui-positioner], [data-base-ui-popup], [data-listbox-panel]')) {
        return
      }
      const isInsideForm = Boolean(formRef.current?.contains(target))
      const isInsideCard = Boolean(containerRef.current?.contains(target))

      if (!isInsideForm && !isInsideCard) {
        if (!input.trim() && !reference && !isProcessing) {
          if (quickCardOpen) {
            handleCollapseCard('close')
          } else {
            closeBar()
          }
        }
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [expanded, quickCardOpen, input, reference, isProcessing, closeBar, isClosing, isCollapsingCard, handleCollapseCard])

  // Auto-open quick card when processing starts if not docked
  useEffect(() => {
    if (isProcessing && dockMode === 'collapsed') {
      setQuickCardOpen(true)
    }
  }, [isProcessing, dockMode])

  const handleSubmit = async (e?: React.FormEvent) => {
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
    setQuickCardOpen(true)
    await sendMessage(finalPrompt, repoPath)
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

  const positionStyle: React.CSSProperties =
    !expanded && !quickCardOpen && !isClosing && position
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
      <GitAgentBarGhosts vanishGhost={vanishGhost} reappearGhost={reappearGhost} />

      <GitAgentAssistiveReminder variant="floating" barPosition={position} isBarExpanded={expanded || quickCardOpen} />

      <GitAgentQuickCard
        ref={containerRef}
        isOpen={quickCardOpen}
        isCollapsing={isCollapsingCard}
        isProcessing={isProcessing}
        lastAssistantMessage={lastAssistantMessage}
        lastUserMessage={lastUserMessage}
        onCollapseCard={handleCollapseCard}
        onDockRight={() => {
          setQuickCardOpen(false)
          setDockMode('dock-right')
        }}
        onRetry={(assistantMsgId) => {
          void retryMessage(assistantMsgId)
        }}
      />

      <form
        ref={formRef}
        style={formStyle}
        onSubmit={handleSubmit}
        onClick={() => {
          if (wasDraggingRef.current) return
          if (!expanded) {
            if (lastAssistantMessage) {
              setExpanded(true)
              setContentVisible(true)
              setQuickCardOpen(true)
            } else {
              openBar()
            }
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (!expanded && !quickCardOpen) return
            event.preventDefault()
            if (quickCardOpen) {
              handleCollapseCard('close')
            } else {
              closeBar()
            }
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
          expanded || quickCardOpen || isClosing
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
          title={expanded ? t('common.close') : lastAssistantMessage ? t('gitAgent.restoreQuickAnswerHint') || '点击展开 Agent 快速答复' : t('gitAgent.barDragHint')}
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
            if (expanded || quickCardOpen) {
              if (quickCardOpen) {
                handleCollapseCard('close')
              } else {
                closeBar()
              }
            } else if (!wasDraggingRef.current) {
              if (lastAssistantMessage) {
                setExpanded(true)
                setContentVisible(true)
                setQuickCardOpen(true)
              } else {
                openBar()
              }
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
            'relative flex size-7 shrink-0 items-center justify-center rounded-full text-accent outline-none',
            expanded || isClosing
              ? 'hover:bg-accent/15 cursor-pointer'
              : isDragging
                ? 'cursor-grabbing bg-accent/25 scale-105 shadow-xs'
                : 'cursor-grab hover:bg-accent/15 touch-none'
          )}
        >
          {isProcessing ? (
            <Spinner className="size-3.5" />
          ) : (
            <>
              <LuBot className="size-4" />
              {!expanded && Boolean(lastAssistantMessage) && (
                <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-accent ring-2 ring-panel animate-pulse pointer-events-none" />
              )}
            </>
          )}
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
          {/* Reference Citation Chip */}
          {reference && (
            <span
              className="flex max-w-[160px] shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent animate-in fade-in zoom-in-95 duration-150"
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
                title="移除引用"
                aria-label="移除引用"
              >
                <LuX className="size-2.5" />
              </button>
            </span>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={reference ? '向 Git Agent 追问或直接按回车发送...' : t('gitAgent.barPlaceholder')}
            className="min-w-0 flex-1 bg-transparent px-1 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none"
            tabIndex={contentVisible ? 0 : -1}
          />

          {/* Restore Recent Answer Button */}
          {Boolean(lastAssistantMessage) && (
            <Tooltip content={t('gitAgent.restoreQuickAnswer') || '还原最近回答'} placement="top">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (quickCardOpen) {
                    handleCollapseCard('pill')
                  } else {
                    setExpanded(true)
                    setContentVisible(true)
                    setQuickCardOpen(true)
                  }
                }}
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-accent hover:bg-accent/15 active:scale-95 transition-all cursor-pointer',
                  quickCardOpen && 'bg-accent/15'
                )}
                aria-label={t('gitAgent.restoreQuickAnswer') || '还原最近回答'}
                tabIndex={contentVisible ? 0 : -1}
              >
                <LuSparkles className="size-3.5 text-accent animate-pulse" />
              </button>
            </Tooltip>
          )}

          {/* Quick Model & Platform Popover */}
          <AgentQuickModelPopover tabIndex={contentVisible ? 0 : -1} />

          {/* Send Button */}
          <Tooltip content={isModelBlocked ? t('gitAgent.modelBlockedNotice') : t('gitAgent.send')} placement="top">
            <span className="inline-flex">
              <button
                type="submit"
                disabled={(!input.trim() && !reference) || isProcessing || isModelBlocked}
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full transition-all',
                  (input.trim() || reference) && !isProcessing && !isModelBlocked
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
