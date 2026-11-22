'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronUp, LuCircleCheck, LuFlag, LuGitBranch, LuGitMerge, LuUndo2 } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { workdeskEngine } from '@/lib/workdesk/engine'
import { undoDismissCard } from '@/lib/workdesk/storage'
import type { WorkCard } from '@/lib/workdesk/types'

import { CARD_I18N_MAP, resolveCardIcon, WorkdeskCard } from './WorkdeskCard'
import { WorkdeskTaskDetailView } from './WorkdeskTaskDetailView'

interface WorkdeskBoardProps {
  initialCards?: WorkCard[]
  initialLastChecked?: number
  initialActiveTaskId?: string
}

interface LaneConfig {
  id: string
  titleKey: 'branch' | 'merge' | 'standard' | 'review'
  icon: React.ReactNode
  badgeColor: string
}

interface CardRect {
  left: number
  top: number
  width: number
  height: number
}

interface TransitionState {
  cardId: string
  startRect: CardRect
  phase: 'lifting' | 'moving' | 'collapsing-start' | 'collapsing'
}

export function WorkdeskBoard({ initialCards = [], initialActiveTaskId }: WorkdeskBoardProps) {
  const t = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const cardOriginMapRef = useRef<Record<string, CardRect>>({})

  const [cards, setCards] = useState<WorkCard[]>(initialCards)
  const [undoToast, setUndoToast] = useState<{ cardId: string; cardTitle: string } | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(initialActiveTaskId || null)
  const [transition, setTransition] = useState<TransitionState | null>(null)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null)

  // Listen to popstate for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/workdesk\/tasks\/([^/]+)/)
      if (match) {
        setActiveTaskId(decodeURIComponent(match[1]))
      } else {
        setActiveTaskId(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSelectCard = (cardId: string, element?: HTMLElement) => {
    if (element && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const cardRect = element.getBoundingClientRect()
      const startRect: CardRect = {
        left: cardRect.left - containerRect.left,
        top: cardRect.top - containerRect.top,
        width: cardRect.width,
        height: cardRect.height,
      }
      cardOriginMapRef.current[cardId] = startRect

      // Step 1: Lift state (hide other cards)
      setTransition({
        cardId,
        startRect,
        phase: 'lifting',
      })

      // Step 2: Next frame animate card moving up to top-left
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransition((prev) => (prev ? { ...prev, phase: 'moving' } : null))
        })
      })

      // Step 3: When animation completes (350ms): switch page & reveal detail contents
      setTimeout(() => {
        setActiveTaskId(cardId)
        setTransition(null)
        if (typeof window !== 'undefined') {
          window.history.pushState(null, '', `/workdesk/tasks/${encodeURIComponent(cardId)}`)
        }
      }, 350)
      return
    }

    // Fallback if no DOM element (e.g. tests or direct call)
    setActiveTaskId(cardId)
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/workdesk/tasks/${encodeURIComponent(cardId)}`)
    }
  }

  const handleCollapseCard = () => {
    const originRect = activeTaskId ? cardOriginMapRef.current[activeTaskId] : null
    if (originRect && activeTaskId) {
      const cardId = activeTaskId
      setTransition({
        cardId,
        startRect: originRect,
        phase: 'collapsing-start',
      })
      setActiveTaskId(null)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransition((prev) => (prev ? { ...prev, phase: 'collapsing' } : null))
        })
      })

      setTimeout(() => {
        setTransition(null)
        if (typeof window !== 'undefined') {
          window.history.pushState(null, '', '/git')
        }
      }, 350)
      return
    }

    setActiveTaskId(null)
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/git')
    }
  }

  // Card Drag-and-Drop between lanes
  const handleCardDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('text/plain', cardId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingCardId(cardId)
  }

  const handleCardDragEnd = () => {
    setDraggingCardId(null)
    setDragOverLaneId(null)
  }

  const handleLaneDragOver = (e: React.DragEvent, laneId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverLaneId !== laneId) {
      setDragOverLaneId(laneId)
    }
  }

  const handleLaneDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOverLaneId(null)
  }

  const handleLaneDrop = (e: React.DragEvent, laneId: string) => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData('text/plain') || draggingCardId
    if (cardId) {
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, categoryId: laneId, updatedAt: Date.now() } : c)))
    }
    setDraggingCardId(null)
    setDragOverLaneId(null)
  }

  // Listen to engine updates and start background timer
  useEffect(() => {
    workdeskEngine.loadInitial().then((cached) => {
      if (cached) {
        setCards(cached.cards)
      }
    })

    const unsubscribe = workdeskEngine.subscribe((result) => {
      setCards(result.cards)
    })

    workdeskEngine.startTimer()
    workdeskEngine.scan().catch(() => {})

    return () => {
      unsubscribe()
      workdeskEngine.stopTimer()
    }
  }, [])

  const handleUndoDismiss = (cardId: string) => {
    undoDismissCard(cardId)
    setUndoToast(null)
    workdeskEngine.scan().catch(() => {})
  }

  useEffect(() => {
    if (!undoToast) return
    const timer = setTimeout(() => {
      setUndoToast(null)
    }, 10000)
    return () => clearTimeout(timer)
  }, [undoToast])

  // Filter out hidden/dismissed cards
  const visibleCards = useMemo(() => {
    return cards.filter((c) => !c.hidden)
  }, [cards])

  const lanes: LaneConfig[] = [
    {
      id: 'branch',
      titleKey: 'branch',
      icon: <LuGitBranch className="size-3.5 text-[#079b85]" aria-hidden="true" />,
      badgeColor: 'text-[#079b85]',
    },
    {
      id: 'merge',
      titleKey: 'merge',
      icon: <LuGitMerge className="size-3.5 text-[#5878aa]" aria-hidden="true" />,
      badgeColor: 'text-[#5878aa]',
    },
    {
      id: 'standard',
      titleKey: 'standard',
      icon: <LuFlag className="size-3.5 text-[#a6751c]" aria-hidden="true" />,
      badgeColor: 'text-[#a6751c]',
    },
    {
      id: 'review',
      titleKey: 'review',
      icon: <LuCircleCheck className="size-3.5 text-[#4a8e7e]" aria-hidden="true" />,
      badgeColor: 'text-[#4a8e7e]',
    },
  ]

  const activeCard = activeTaskId ? cards.find((c) => c.id === activeTaskId) : undefined

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-paper select-text">
      {/* Hero Proxy Floating Card during transition */}
      {transition &&
        (() => {
          const c = cards.find((item) => item.id === transition.cardId)
          if (!c) return null
          const i18nKey = CARD_I18N_MAP[c.id]
          const rawTitle = i18nKey ? t(`workdesk.cards.${i18nKey}.title` as MessageKey) : undefined
          const title = rawTitle && !rawTitle.startsWith('workdesk.cards.') ? rawTitle : c.title
          const isTarget = transition.phase === 'moving' || transition.phase === 'collapsing-start'
          const targetWidth = typeof window !== 'undefined' ? (window.innerWidth >= 1024 ? 332 : window.innerWidth >= 640 ? 300 : 268) : 300

          return (
            <div
              style={{
                position: 'absolute',
                left: isTarget ? 10 : transition.startRect.left,
                top: isTarget ? 10 : transition.startRect.top,
                width: isTarget ? targetWidth : transition.startRect.width,
                height: transition.startRect.height,
                zIndex: 50,
                transition: transition.phase === 'moving' || transition.phase === 'collapsing' ? 'all 350ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
              }}
              className="pointer-events-none flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-line bg-panel p-2.5 shadow-md dark:border-line dark:bg-panel"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eef5f2] dark:bg-emerald-950/40">{resolveCardIcon(c.iconName, c.categoryId)}</div>
                <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                  <span className="line-clamp-2 text-xs font-semibold leading-tight text-ink">{title}</span>
                  <span className="mt-0.5 text-[11px] leading-none text-ink-muted">{c.scope}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center text-ink-soft">
                <LuChevronUp className="size-3.5" aria-hidden="true" />
              </div>
            </div>
          )
        })()}

      {/* Expanded Detail View */}
      {activeTaskId && !transition && (
        <div className="relative flex min-h-0 flex-1 overflow-hidden animate-in fade-in duration-200">
          <WorkdeskTaskDetailView taskId={activeTaskId} initialCard={activeCard} onCollapse={handleCollapseCard} />
        </div>
      )}

      {/* 4-Lane Board (Hidden or fading out when activeTaskId or during transition) */}
      {!activeTaskId && (
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-20 sm:px-6 sm:pb-24 lg:px-8 lg:pb-24 transition-all duration-200',
            transition && 'pointer-events-none scale-[0.98] opacity-0'
          )}
        >
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {lanes.map((lane) => {
              const laneCards = visibleCards.filter((c) => c.categoryId === lane.id)
              const laneTitle = t(`workdesk.lane.${lane.titleKey}`)

              return (
                <div
                  key={lane.id}
                  onDragOver={(e) => handleLaneDragOver(e, lane.id)}
                  onDragLeave={handleLaneDragLeave}
                  onDrop={(e) => handleLaneDrop(e, lane.id)}
                  className={cn(
                    'flex min-h-[160px] flex-col rounded-xl border border-line/60 bg-panel-2/40 p-2.5 transition-all duration-150 dark:bg-panel-2/20',
                    dragOverLaneId === lane.id && 'ring-2 ring-accent/40 bg-accent/5 border-accent/60'
                  )}
                >
                  {/* Lane Header */}
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      {lane.icon}
                      <span className="text-xs font-bold text-ink">{laneTitle}</span>
                    </div>
                    <span className={cn('text-[11px] font-semibold text-ink-muted', laneCards.length > 0 && lane.badgeColor)}>{laneCards.length}</span>
                  </div>

                  {/* Cards List in Lane */}
                  <div className="flex flex-1 flex-col gap-2">
                    {laneCards.length > 0 ? (
                      laneCards.map((card) => (
                        <div
                          key={card.id}
                          draggable={!transition}
                          onDragStart={(e) => handleCardDragStart(e, card.id)}
                          onDragEnd={handleCardDragEnd}
                          className={cn('transition-all duration-150', draggingCardId === card.id ? 'opacity-40 scale-[0.98] cursor-grabbing' : 'cursor-grab')}
                        >
                          <WorkdeskCard key={card.id} card={card} onSelect={handleSelectCard} />
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line/40 py-6 text-center">
                        <span className="text-[11px] text-ink-soft">无待办任务</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Undo Toast for dismissed cards */}
          {undoToast && (
            <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-panel px-4 py-2 shadow-lg">
              <span className="text-xs text-ink">{t('workdesk.status.dismissed')}</span>
              <button
                onClick={() => handleUndoDismiss(undoToast.cardId)}
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline focus-visible:outline-hidden"
              >
                <LuUndo2 className="size-3.5" aria-hidden="true" />
                {t('workdesk.action.undoDismiss')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
