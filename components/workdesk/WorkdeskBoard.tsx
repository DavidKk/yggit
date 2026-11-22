'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { LuCircleCheck, LuDownload, LuFlag, LuGitBranch, LuGitMerge, LuRefreshCw, LuUndo2 } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button } from '@/components/sk'
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

export function WorkdeskBoard({ initialCards = [], initialLastChecked = 0 }: WorkdeskBoardProps) {
  const t = useT()
  const [cards, setCards] = useState<WorkCard[]>(initialCards)
  const [lastChecked, setLastChecked] = useState<number>(initialLastChecked)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [undoToast, setUndoToast] = useState<{ cardId: string; cardTitle: string } | null>(null)

  useEffect(() => {
    setCurrentTime(Date.now())
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Listen to engine updates and start background timer
  useEffect(() => {
    // Fast-pass initial cache load if not provided
    workdeskEngine.loadInitial().then((cached) => {
      if (cached) {
        setCards(cached.cards)
        setLastChecked(cached.lastChecked)
      }
    })

    const unsubscribe = workdeskEngine.subscribe((result) => {
      setCards(result.cards)
      setLastChecked(result.lastChecked)
      setIsRefreshing(false)
    })

    workdeskEngine.startTimer()

    // Trigger an initial active scan if no cards loaded yet
    workdeskEngine.scan().catch(() => {})

    return () => {
      unsubscribe()
      workdeskEngine.stopTimer()
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await workdeskEngine.scan()
    } finally {
      setIsRefreshing(false)
    }
  }

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

  const formatLastChecked = (timeMs: number, nowMs: number) => {
    if (!timeMs || !nowMs) return t('workdesk.justNow')
    const diffMins = Math.floor((nowMs - timeMs) / (60 * 1000))
    if (diffMins <= 0) return t('workdesk.justNow')
    return t('workdesk.minutesAgo', { minutes: diffMins })
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
      {/* Top Bar Status & Actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span>{t('workdesk.lastChecked', { time: formatLastChecked(lastChecked, currentTime) })}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/import">
            <Button size="sm" className="h-7 text-xs">
              <LuDownload className="mr-1.5 size-3.5" aria-hidden="true" />
              {t('workdesk.action.importRecipe')}
            </Button>
          </Link>

          <Button size="sm" className="h-7 text-xs" onClick={handleRefresh} disabled={isRefreshing}>
            <LuRefreshCw className={cn('mr-1.5 size-3.5', isRefreshing && 'animate-spin text-accent')} aria-hidden="true" />
            {t('workdesk.action.refresh')}
          </Button>
        </div>
      </div>

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

      {/* Empty State when no visible cards across entire board */}
      {visibleCards.length === 0 && (
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <LuCircleCheck className="size-6" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-ink">{t('workdesk.emptyTitle')}</h3>
          <p className="mt-1 max-w-sm text-xs text-ink-muted">{t('workdesk.emptyDesc')}</p>
        </div>
      )}

      {/* Undo Toast for dismissed cards */}
      {undoToast && (
        <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-panel-1 px-4 py-2 shadow-lg dark:bg-panel-2">
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
