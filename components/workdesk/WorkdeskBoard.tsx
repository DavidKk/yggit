'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { LuCircleCheck, LuFlag, LuGitBranch, LuGitMerge, LuUndo2 } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { cn } from '@/lib/utils'
import { workdeskEngine } from '@/lib/workdesk/engine'
import { undoDismissCard } from '@/lib/workdesk/storage'
import type { WorkCard } from '@/lib/workdesk/types'

import { WorkdeskCard } from './WorkdeskCard'

interface WorkdeskBoardProps {
  initialCards?: WorkCard[]
  initialLastChecked?: number
}

interface LaneConfig {
  id: string
  titleKey: 'branch' | 'merge' | 'standard' | 'review'
  icon: React.ReactNode
  badgeColor: string
}

export function WorkdeskBoard({ initialCards = [] }: WorkdeskBoardProps) {
  const t = useT()
  const [cards, setCards] = useState<WorkCard[]>(initialCards)
  const [undoToast, setUndoToast] = useState<{ cardId: string; cardTitle: string } | null>(null)

  // Listen to engine updates and start background timer
  useEffect(() => {
    // Fast-pass initial cache load if not provided
    workdeskEngine.loadInitial().then((cached) => {
      if (cached) {
        setCards(cached.cards)
      }
    })

    const unsubscribe = workdeskEngine.subscribe((result) => {
      setCards(result.cards)
    })

    workdeskEngine.startTimer()

    // Trigger an initial active scan if no cards loaded yet
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

  // Auto-dismiss undo toast after 10 seconds
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
      {/* 4-Lane Adaptive Board */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {lanes.map((lane) => {
          const laneCards = visibleCards.filter((c) => c.categoryId === lane.id)
          const laneTitle = t(`workdesk.lane.${lane.titleKey}`)

          return (
            <div key={lane.id} className="flex min-h-[160px] flex-col rounded-xl border border-line/60 bg-panel-2/40 p-2.5 dark:bg-panel-2/20">
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
                  laneCards.map((card) => <WorkdeskCard key={card.id} card={card} />)
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
  )
}
