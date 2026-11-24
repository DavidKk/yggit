'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowLeft, LuBot, LuFolderArchive, LuX } from 'react-icons/lu'

import { useLocale, useT } from '@/components/i18n/LocaleProvider'
import { Button, Tooltip } from '@/components/sk'
import { quoteWorkdeskTaskToAgent } from '@/lib/agent/agent-quote'
import { setWorkdeskContext } from '@/lib/agent/workdesk-context'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { workdeskEngine } from '@/lib/workdesk/engine'
import type { WorkCard, WorkItem } from '@/lib/workdesk/types'

import { getCrAnalysis, getItemCardSummary, getItemProblemTitle } from './workdesk-detail-helpers'
import { WorkdeskEvidencePanel } from './WorkdeskEvidencePanel'

export { getCrAnalysis, getItemCardSummary, getItemProblemTitle }

const CARD_I18N_MAP: Record<string, string> = {
  'sync-default-branches': 'syncDefaultBranches',
  'worktree-parallel-dev': 'worktreeParallelDev',
  'merge-diverged-branches': 'mergeDivergedBranches',
  'standard-repo-hygiene': 'standardRepoHygiene',
  'standard-project-organization': 'standardProjectOrganization',
  'review-pending-commits': 'reviewPendingCommits',
}

interface WorkdeskTaskDetailViewProps {
  taskId: string
  initialItemId?: string
  initialCard?: WorkCard
  initialItems?: WorkItem[]
  onCollapse?: () => void
  cardWidth?: number
}

export function WorkdeskTaskDetailView({ taskId, initialItemId, initialCard, initialItems = [], onCollapse, cardWidth }: WorkdeskTaskDetailViewProps) {
  const t = useT()
  const { locale } = useLocale()
  const router = useRouter()

  const [card, setCard] = useState<WorkCard | undefined>(initialCard)
  const [isLoading, setIsLoading] = useState<boolean>(!initialCard)
  const [itemsMap, setItemsMap] = useState<Record<string, WorkItem>>(() => {
    const map: Record<string, WorkItem> = {}
    for (const item of initialItems) {
      map[item.id] = item
    }
    return map
  })
  const [activeItemId, setActiveItemId] = useState<string>(initialItemId || '')

  // Listen to engine updates
  useEffect(() => {
    let mounted = true
    const unsubscribe = workdeskEngine.subscribe((result) => {
      if (!mounted) return
      const foundCard = result.cards.find((c) => c.id === taskId)
      if (foundCard) {
        setCard(foundCard)
      }
      setItemsMap(result.items)
      setIsLoading(false)
    })

    if (!card) {
      workdeskEngine.loadInitial().then((cached) => {
        if (!mounted) return
        if (cached) {
          const found = cached.cards.find((c) => c.id === taskId)
          if (found) {
            setCard(found)
            setItemsMap(cached.items)
            setIsLoading(false)
            return
          }
        }
        // If not in cache or card not found, trigger scan
        workdeskEngine
          .scan()
          .then((scanned) => {
            if (!mounted) return
            const found = scanned.cards.find((c) => c.id === taskId)
            if (found) setCard(found)
            setItemsMap(scanned.items)
            setIsLoading(false)
          })
          .catch(() => {
            if (mounted) setIsLoading(false)
          })
      })
    } else {
      setIsLoading(false)
    }

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [taskId, card])

  // Get list of work items for this card
  const taskItems = useMemo(() => {
    if (!card) return []
    return card.itemIds.map((id) => itemsMap[id]).filter(Boolean)
  }, [card, itemsMap])

  const isMultiple = Boolean((card && card.itemIds && card.itemIds.length > 1) || taskItems.length > 1 || (card?.projectCount ?? 1) > 1)

  // Ensure an active item is selected
  useEffect(() => {
    if (taskItems.length > 0) {
      if (!activeItemId || !itemsMap[activeItemId]) {
        const first = taskItems[0]
        setActiveItemId(first.id)
      }
    }
  }, [taskItems, activeItemId, itemsMap])

  const activeItem = itemsMap[activeItemId] || taskItems[0]

  // Inject context into Git Agent
  useEffect(() => {
    if (card && activeItem) {
      setWorkdeskContext({
        source: 'workdesk',
        taskId: card.id,
        taskTitle: card.title,
        activeItemId: activeItem.id,
        repoIdentity: activeItem.repoId,
        repoAlias: activeItem.repoAlias,
        targetRef: activeItem.name,
        evidenceCommits: activeItem.commit ? [activeItem.commit] : [],
        evidencePaths: activeItem.paths || [],
        state: activeItem.state,
        summary: activeItem.summary,
      })
    }
    return () => {
      setWorkdeskContext(null)
    }
  }, [card, activeItem])

  // Cascade card dealing animation on initial open
  const [isDealing, setIsDealing] = useState(true)
  const [isGathering, setIsGathering] = useState(false)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)

  // Infinite scrolling: render items progressively to avoid DOM bloat and lagging
  const PAGE_SIZE = 25
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Auto-expand visibleLimit if activeItemId is beyond the current limit
  useEffect(() => {
    if (activeItemId && taskItems.length > 0) {
      const activeIdx = taskItems.findIndex((it) => it.id === activeItemId)
      if (activeIdx >= visibleLimit) {
        setVisibleLimit(Math.min(taskItems.length, activeIdx + 15))
      }
    }
  }, [activeItemId, taskItems, visibleLimit])

  // Reset limit when card changes
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE)
  }, [card?.id])

  const renderedItems = useMemo(() => {
    return taskItems.slice(0, visibleLimit)
  }, [taskItems, visibleLimit])

  // Custom scrollbar tracking for task list
  const [scrollRatio, setScrollRatio] = useState<{ offset: number; size: number; visible: boolean }>({ offset: 0, size: 0, visible: false })
  const [isHoveringList, setIsHoveringList] = useState(false)
  const [isScrollingList, setIsScrollingList] = useState(false)
  const [isDraggingThumb, setIsDraggingThumb] = useState(false)
  const scrollIdleTimerRef = useRef<number | null>(null)
  const dragStartYRef = useRef(0)
  const dragStartScrollTopRef = useRef(0)

  const updateScrollbar = useCallback(() => {
    const el = listContainerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight + 1) {
      setScrollRatio((prev) => (prev.visible ? { offset: 0, size: 0, visible: false } : prev))
      return
    }
    const minThumb = 24
    const size = Math.max(minThumb, Math.round((clientHeight / scrollHeight) * clientHeight))
    const maxScroll = scrollHeight - clientHeight
    const offset = maxScroll <= 0 ? 0 : Math.round((scrollTop / maxScroll) * Math.max(0, clientHeight - size))
    setScrollRatio({ offset, size, visible: true })
  }, [])

  useEffect(() => {
    updateScrollbar()
    const el = listContainerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => updateScrollbar())
    ro.observe(el)
    return () => ro.disconnect()
  }, [renderedItems.length, updateScrollbar])

  // Infinite scroll trigger via scroll listener and IntersectionObserver
  const handleListScroll = useCallback(() => {
    const el = listContainerRef.current
    if (!el) return
    updateScrollbar()
    setIsScrollingList(true)
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
    scrollIdleTimerRef.current = window.setTimeout(() => {
      setIsScrollingList(false)
    }, 700)

    if (el.scrollHeight - el.scrollTop - el.clientHeight < 250) {
      setVisibleLimit((prev) => (prev < taskItems.length ? Math.min(prev + PAGE_SIZE, taskItems.length) : prev))
    }
  }, [taskItems.length, updateScrollbar])

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingThumb(true)
    dragStartYRef.current = e.clientY
    dragStartScrollTopRef.current = listContainerRef.current?.scrollTop || 0

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const el = listContainerRef.current
      if (!el) return
      const deltaY = moveEvent.clientY - dragStartYRef.current
      const maxScroll = el.scrollHeight - el.clientHeight
      const trackAvailable = el.clientHeight - scrollRatio.size
      if (trackAvailable > 0) {
        const scrollDelta = (deltaY / trackAvailable) * maxScroll
        el.scrollTop = dragStartScrollTopRef.current + scrollDelta
      }
    }

    const handleMouseUp = () => {
      setIsDraggingThumb(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const el = listContainerRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const ratio = clickY / rect.height
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleLimit((prev) => (prev < taskItems.length ? Math.min(prev + PAGE_SIZE, taskItems.length) : prev))
        }
      },
      { root: listContainerRef.current, rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [taskItems.length])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDealing(false)
    }, 550)
    return () => clearTimeout(timer)
  }, [])

  // Listen to popstate for browser back/forward item navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/workdesk\/tasks\/[^/]+\/items\/([^/]+)/)
      if (match) {
        setActiveItemId(decodeURIComponent(match[1]))
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Switch item smoothly without triggering Next.js route reload or remounting layout
  const handleSelectItem = useCallback(
    (itemId: string) => {
      setActiveItemId(itemId)
      if (typeof window !== 'undefined') {
        const nextUrl = `/workdesk/tasks/${encodeURIComponent(taskId)}/items/${encodeURIComponent(itemId)}`
        if (window.location.pathname !== nextUrl) {
          window.history.replaceState(null, '', nextUrl)
        }
      }
    },
    [taskId]
  )

  const handleReorderItems = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return
    setCard((prev) => {
      if (!prev) return prev
      const ids = [...prev.itemIds]
      const sourceIdx = ids.indexOf(sourceId)
      const targetIdx = ids.indexOf(targetId)
      if (sourceIdx === -1 || targetIdx === -1) return prev
      ids.splice(sourceIdx, 1)
      ids.splice(targetIdx, 0, sourceId)
      return { ...prev, itemIds: ids }
    })
  }, [])

  const cardTitle = useMemo(() => {
    if (!card) return ''
    const i18nKey = CARD_I18N_MAP[card.id]
    const rawTitle = i18nKey ? t(`workdesk.cards.${i18nKey}.title` as MessageKey) : undefined
    return rawTitle && !rawTitle.startsWith('workdesk.cards.') ? rawTitle : card.title
  }, [card, t])

  const handleSendToAgent = useCallback(
    (item?: WorkItem) => {
      const target = item || activeItem
      if (!target || !card) return
      const cr = getCrAnalysis(card.id, target, locale)
      const isEn = locale.startsWith('en')
      const prompt = isEn
        ? `Please assist in resolving workdesk task [${cardTitle}]:
- Target project: ${target.repoAlias || target.repoId}
- Target branch: ${target.name}
- Problem description: ${target.summary}
- Root cause: ${cr.cause}
- Potential risk: ${cr.risk}
- Recommended solution:
${cr.solution}

Please refer to the recommended solution above to assist with execution or automated handling of this task.`
        : `请协助处理工作台任务【${cardTitle}】：
- 目标项目: ${target.repoAlias || target.repoId}
- 目标分支: ${target.name}
- 问题描述: ${target.summary}
- 产生原因: ${cr.cause}
- 潜在风险: ${cr.risk}
- 推荐解决方案:
${cr.solution}

请参考上述推荐解决方案，协助执行或自动化处理此任务。`

      const refTitle = target.repoAlias ? `${cardTitle} · ${target.repoAlias}` : cardTitle

      quoteWorkdeskTaskToAgent({
        title: refTitle,
        prompt,
        taskId: card.id,
        itemId: target.id,
        repoId: target.repoId,
        repoAlias: target.repoAlias,
        branch: target.name,
        summary: target.summary,
        solution: cr.solution,
      })
    },
    [activeItem, card, cardTitle, locale]
  )

  // Collect cards upwards into top-left deck before collapsing back to board
  const handleCollapse = useCallback(() => {
    if (isGathering) return
    setIsGathering(true)
    if (process.env.NODE_ENV === 'test') {
      if (onCollapse) {
        onCollapse()
      } else {
        router.push('/workdesk')
      }
      return
    }
    setTimeout(() => {
      if (onCollapse) {
        onCollapse()
      } else {
        router.push('/workdesk')
      }
    }, 240)
  }, [isGathering, onCollapse, router])

  if (!card) {
    if (isLoading) {
      return (
        <div className="flex min-h-0 flex-1 divide-x divide-line">
          <div
            style={{ width: cardWidth ? Math.min(cardWidth, 300) + 24 : undefined }}
            className={cn('flex shrink-0 flex-col border-r border-line bg-panel-2/30 p-2.5', !cardWidth && 'w-64 sm:w-72 lg:w-80')}
          >
            <div className="h-[62px] w-full animate-pulse rounded-xl bg-panel/70 border border-line/40" />
            <div className="mt-3 flex flex-col gap-2.5">
              <div className="h-24 w-full animate-pulse rounded-xl bg-panel/50 border border-line/30" />
              <div className="h-24 w-full animate-pulse rounded-xl bg-panel/50 border border-line/30" />
              <div className="h-24 w-full animate-pulse rounded-xl bg-panel/50 border border-line/30" />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-panel-2/20">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span>正在加载任务详情...</span>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-ink-muted">未找到该工作任务或任务已失效</p>
        <Link href="/workdesk" className="mt-4">
          <Button size="sm">
            <LuArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
            {t('workdesk.action.back')}
          </Button>
        </Link>
      </div>
    )
  }

  const renderStateDot = (state: 'safe' | 'warn' | 'bad') => {
    if (state === 'safe') return <span className="h-3.5 w-1 shrink-0 rounded-full bg-[#28a388]" aria-hidden="true" />
    if (state === 'warn') return <span className="h-3.5 w-1 shrink-0 rounded-full bg-[#d8a646]" aria-hidden="true" />
    return <span className="h-3.5 w-1 shrink-0 rounded-full bg-[#d96c61]" aria-hidden="true" />
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {/* Main Split Layout: Left List + Right Evidence */}
      <div className="flex min-h-0 flex-1">
        {/* Left Column: Task Navigation List */}
        <div
          style={{ width: cardWidth ? Math.min(cardWidth, 300) + 24 : undefined }}
          className={cn('relative flex shrink-0 flex-col overflow-hidden border-r border-line bg-panel-2/30', !cardWidth && 'w-64 sm:w-72 lg:w-80')}
          onMouseEnter={() => setIsHoveringList(true)}
          onMouseLeave={() => setIsHoveringList(false)}
        >
          {/* Top-Left Task Set Bar (Clean non-card header so first task item is the real card) */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 bg-panel-2/60 select-none animate-in fade-in duration-200">
            <div className="flex min-w-0 items-center gap-2">
              <LuFolderArchive className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="truncate text-xs font-bold text-ink" title={cardTitle}>
                {cardTitle}
              </span>
              <span className="rounded-full bg-line/60 px-1.5 py-0.2 text-[10px] font-semibold text-ink-muted">{taskItems.length}</span>
            </div>
            <Tooltip content={t('workdesk.detail.closeTaskSet')} placement="bottom">
              <button
                type="button"
                onClick={handleCollapse}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink active:scale-95 transition-colors cursor-pointer outline-hidden"
                aria-label={t('workdesk.detail.closeTaskSet')}
                data-testid="workdesk-detail-close-btn"
              >
                <LuX className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>

          {/* Keyframes for Dealing Downwards and Gathering Upwards */}
          <style>{`
            @keyframes workdeskCardDeal {
              0% {
                opacity: 0;
                transform: translateY(-16px) scale(0.97);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            @keyframes workdeskCardGather {
              0% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
              100% {
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
              }
            }
            @keyframes workdeskStackDealMiddle {
              0% {
                opacity: 0.9;
                transform: translate(4px, -4px) rotate(-0.8deg);
              }
              45% {
                opacity: 0.9;
                transform: translate(4px, -4px) rotate(-0.8deg);
              }
              75% {
                opacity: 0.5;
                transform: translate(2px, -2px) rotate(-0.4deg);
              }
              100% {
                opacity: 0;
                transform: translate(0px, 0px) rotate(0deg);
              }
            }
            @keyframes workdeskStackDealBottom {
              0% {
                opacity: 0.8;
                transform: translate(6px, 6px) rotate(1.2deg);
              }
              45% {
                opacity: 0.8;
                transform: translate(6px, 6px) rotate(1.2deg);
              }
              75% {
                opacity: 0.4;
                transform: translate(3px, 3px) rotate(0.6deg);
              }
              100% {
                opacity: 0;
                transform: translate(0px, 0px) rotate(0deg);
              }
            }
            @keyframes workdeskStackGatherMiddle {
              0% {
                opacity: 0;
                transform: translate(0px, 0px) rotate(0deg);
              }
              30% {
                opacity: 0.4;
                transform: translate(2px, -2px) rotate(-0.4deg);
              }
              100% {
                opacity: 0.9;
                transform: translate(4px, -4px) rotate(-0.8deg);
              }
            }
            @keyframes workdeskStackGatherBottom {
              0% {
                opacity: 0;
                transform: translate(0px, 0px) rotate(0deg);
              }
              30% {
                opacity: 0.3;
                transform: translate(3px, 3px) rotate(0.6deg);
              }
              100% {
                opacity: 0.8;
                transform: translate(6px, 6px) rotate(1.2deg);
              }
            }
          `}</style>

          {/* Dealing Cards List with Progressive Infinite Scrolling */}
          <div ref={listContainerRef} onScroll={handleListScroll} className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-20 overscroll-contain">
            {renderedItems.map((item, itemIndex) => {
              const isSelected = item.id === activeItem?.id
              const isItemDragging = draggingItemId === item.id
              const isItemOver = dragOverItemId === item.id

              return (
                <div
                  key={item.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation()
                    e.dataTransfer.setData('text/plain', item.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingItemId(item.id)
                  }}
                  onDragEnd={() => {
                    setDraggingItemId(null)
                    setDragOverItemId(null)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverItemId !== item.id) {
                      setDragOverItemId(item.id)
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverItemId(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const srcId = e.dataTransfer.getData('text/plain') || draggingItemId
                    if (srcId && srcId !== item.id) {
                      handleReorderItems(srcId, item.id)
                    }
                    setDraggingItemId(null)
                    setDragOverItemId(null)
                  }}
                  onClick={() => handleSelectItem(item.id)}
                  style={{
                    animation: isGathering
                      ? `workdeskCardGather 200ms cubic-bezier(0.2, 0.8, 0.2, 1) ${Math.min(itemIndex, 4) * 8}ms both`
                      : isDealing && itemIndex > 0
                        ? `workdeskCardDeal 240ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(itemIndex, 8) * 35}ms both`
                        : undefined,
                  }}
                  className={cn(
                    'group relative flex h-[62px] min-h-[62px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 shadow-xs transition-all duration-150 select-none shrink-0',
                    itemIndex === 0 && isMultiple && (isDealing || isGathering) && 'z-10',
                    isSelected
                      ? 'border-[#b5ddd4] bg-[#f8fcfa] shadow-xs dark:border-emerald-700/60 dark:bg-emerald-950/30'
                      : 'border-line bg-panel hover:border-[#b5ddd4] hover:bg-[#f8fcfa] hover:shadow-sm dark:hover:border-emerald-700/50 dark:hover:bg-emerald-950/20',
                    isItemDragging && 'opacity-40 scale-[0.98]',
                    isItemOver && 'ring-1 ring-accent',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40'
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelectItem(item.id)
                    }
                  }}
                  aria-label={`${item.repoAlias ? `${item.repoAlias} · ${item.name}` : item.name} - ${item.summary}`}
                >
                  {/* Stacked Card Deck underlayers: preserved during flight, dealing and gathering */}
                  {itemIndex === 0 && isMultiple && (isDealing || isGathering) && (
                    <>
                      <div
                        data-testid="card-stack-layer-bottom"
                        style={{
                          animation: isGathering
                            ? 'workdeskStackGatherBottom 220ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                            : isDealing
                              ? 'workdeskStackDealBottom 380ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                              : undefined,
                        }}
                        className="absolute inset-0 -z-10 rounded-xl border border-line/60 bg-panel shadow-2xs pointer-events-none origin-top-left dark:border-line/40 dark:bg-panel"
                        aria-hidden="true"
                      />
                      <div
                        data-testid="card-stack-layer-middle"
                        style={{
                          animation: isGathering
                            ? 'workdeskStackGatherMiddle 220ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                            : isDealing
                              ? 'workdeskStackDealMiddle 380ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                              : undefined,
                        }}
                        className="absolute inset-0 -z-10 rounded-xl border border-line/80 bg-panel shadow-2xs pointer-events-none origin-top-left dark:border-line/60 dark:bg-panel"
                        aria-hidden="true"
                      />
                    </>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                    <span className="line-clamp-1 text-xs font-semibold leading-tight text-ink transition-colors group-hover:text-ink-vivid">
                      {item.repoAlias ? `${item.repoAlias} · ${item.name}` : item.name}
                    </span>
                    <span className="mt-1 line-clamp-1 text-[11px] leading-tight text-ink-muted">{getItemCardSummary(item.summary)}</span>
                  </div>

                  {/* Right Status Dot & Agent Quick Action */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Tooltip content={t('git.operations.quoteToAgent') || 'Quote to Git Agent'} placement="top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSendToAgent(item)
                        }}
                        className="flex size-5 items-center justify-center rounded-md text-ink-muted opacity-0 group-hover:opacity-100 hover:bg-accent/15 hover:text-accent transition-all duration-150 cursor-pointer"
                        aria-label={t('git.operations.quoteToAgent') || 'Quote to Git Agent'}
                      >
                        <LuBot className="size-3" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip
                      content={item.state === 'safe' ? '状态正常 / 可快速合并' : item.state === 'warn' ? '需关注 / 存在分支分叉或未同步' : '待处理异常 / 需人工介入'}
                      placement="top"
                    >
                      <span className="inline-flex items-center cursor-default">{renderStateDot(item.state)}</span>
                    </Tooltip>
                  </div>
                </div>
              )
            })}

            {/* Infinite Scroll Sentinel / Loading More */}
            {visibleLimit < taskItems.length && (
              <div ref={sentinelRef} className="flex h-9 shrink-0 items-center justify-center py-2 text-xs text-ink-muted select-none">
                <span className="mr-2 size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span>{t('common.loading') || 'Loading more…'}</span>
              </div>
            )}
          </div>

          {/* Custom Sleek Scrollbar Overlay */}
          {scrollRatio.visible && (
            <div
              onClick={handleTrackClick}
              className={cn(
                'absolute top-11 right-0.5 bottom-0 z-20 w-2.5 transition-opacity duration-200 cursor-pointer select-none',
                isHoveringList || isScrollingList || isDraggingThumb ? 'opacity-100' : 'opacity-0'
              )}
              aria-hidden="true"
            >
              <div
                onMouseDown={handleThumbMouseDown}
                style={{
                  transform: `translateY(${scrollRatio.offset}px)`,
                  height: `${scrollRatio.size}px`,
                }}
                className="w-1.5 mx-auto rounded-full bg-ink-soft/40 hover:bg-ink-soft/70 active:bg-ink-soft/90 transition-colors cursor-grab active:cursor-grabbing"
              />
            </div>
          )}
        </div>

        {/* Right Column: Evidence Details (Single Unified Block) */}
        <WorkdeskEvidencePanel card={card} activeItem={activeItem} isGathering={isGathering} locale={locale} t={t} handleSendToAgent={handleSendToAgent} />
      </div>
    </div>
  )
}
