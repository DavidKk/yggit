'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LuArrowLeft,
  LuChevronUp,
  LuExternalLink,
  LuFileCode,
  LuFolder,
  LuFolderGit2,
  LuFolderTree,
  LuGitBranch,
  LuGitCommitHorizontal,
  LuInfo,
  LuTrash2,
  LuUndo2,
} from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button } from '@/components/sk'
import { setWorkdeskContext } from '@/lib/agent/workdesk-context'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { workdeskEngine } from '@/lib/workdesk/engine'
import { dismissCard, undoDismissCard } from '@/lib/workdesk/storage'
import type { WorkCard, WorkItem } from '@/lib/workdesk/types'

import { resolveCardIcon } from './WorkdeskCard'

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
}

export function WorkdeskTaskDetailView({ taskId, initialItemId, initialCard, initialItems = [], onCollapse }: WorkdeskTaskDetailViewProps) {
  const t = useT()
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
  const [undoToast, setUndoToast] = useState<{ cardId: string } | null>(null)

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

  // Group task items by repoAlias
  const groupedItems = useMemo(() => {
    const groups: Record<string, WorkItem[]> = {}
    for (const item of taskItems) {
      const groupKey = item.repoAlias || item.repoId
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(item)
    }
    return groups
  }, [taskItems])

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

  const handleDismissCard = () => {
    if (!card) return
    dismissCard(card.id)
    setUndoToast({ cardId: card.id })
  }

  const handleUndoDismiss = (cardId: string) => {
    undoDismissCard(cardId)
    setUndoToast(null)
  }

  const cardTitle = useMemo(() => {
    if (!card) return ''
    const i18nKey = CARD_I18N_MAP[card.id]
    const rawTitle = i18nKey ? t(`workdesk.cards.${i18nKey}.title` as MessageKey) : undefined
    return rawTitle && !rawTitle.startsWith('workdesk.cards.') ? rawTitle : card.title
  }, [card, t])

  // Collect cards upwards into top-left deck before collapsing back to board
  const handleCollapse = useCallback(() => {
    if (isGathering) return
    setIsGathering(true)
    if (process.env.NODE_ENV === 'test') {
      if (onCollapse) {
        onCollapse()
      } else {
        router.push('/git')
      }
      return
    }
    setTimeout(() => {
      if (onCollapse) {
        onCollapse()
      } else {
        router.push('/git')
      }
    }, 180)
  }, [isGathering, onCollapse, router])

  // Auto-redirect if dismissed and undo timeout expires
  useEffect(() => {
    if (!undoToast) return
    const timer = setTimeout(() => {
      router.push('/workdesk')
    }, 10000)
    return () => clearTimeout(timer)
  }, [undoToast, router])

  if (!card) {
    if (isLoading) {
      return (
        <div className="flex min-h-0 flex-1 divide-x divide-line">
          <div className="flex w-72 shrink-0 flex-col border-r border-line bg-panel-2/30 p-2.5 sm:w-80 lg:w-88">
            <div className="h-[58px] w-full animate-pulse rounded-xl bg-panel/70 border border-line/40" />
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
        <Link href="/git" className="mt-4">
          <Button size="sm">
            <LuArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
            {t('workdesk.action.back')}
          </Button>
        </Link>
      </div>
    )
  }

  const renderStateDot = (state: 'safe' | 'warn' | 'bad') => {
    if (state === 'safe') return <span className="size-2 shrink-0 rounded-full bg-[#28a388]" aria-hidden="true" />
    if (state === 'warn') return <span className="size-2 shrink-0 rounded-full bg-[#d8a646]" aria-hidden="true" />
    return <span className="size-2 shrink-0 rounded-full bg-[#d96c61]" aria-hidden="true" />
  }

  const renderStateBadge = (state: 'safe' | 'warn' | 'bad') => {
    if (state === 'safe') {
      return (
        <Badge tone="ok" size="mini">
          {t('workdesk.status.safe')}
        </Badge>
      )
    }
    if (state === 'warn') {
      return (
        <Badge tone="warn" size="mini">
          {t('workdesk.status.warn')}
        </Badge>
      )
    }
    return (
      <Badge tone="fail" size="mini">
        {t('workdesk.status.bad')}
      </Badge>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {/* Main Split Layout: Left List + Right Evidence */}
      <div className="flex min-h-0 flex-1 divide-x divide-line">
        {/* Left Column: Task Navigation List */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-line bg-panel-2/30 sm:w-80 lg:w-88">
          {/* Top-Left Card (Exact same card style, click to collapse back) */}
          <div className="shrink-0 p-2.5 pb-0">
            <button
              type="button"
              onClick={handleCollapse}
              className={cn(
                'group relative flex min-h-[58px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-panel p-2.5 shadow-xs transition-all duration-150',
                'hover:border-[#b5ddd4] hover:bg-[#f8fcfa] hover:shadow-sm dark:hover:border-emerald-700/50 dark:hover:bg-emerald-950/20',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40'
              )}
              title={t('workdesk.action.back')}
              aria-label={`${cardTitle} - ${t('workdesk.action.back')}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eef5f2] transition-colors',
                    'group-hover:bg-[#e2f1ec] dark:bg-emerald-950/40 dark:group-hover:bg-emerald-900/50'
                  )}
                  aria-hidden="true"
                >
                  {resolveCardIcon(card.iconName, card.categoryId)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                  <span className="line-clamp-2 text-xs font-semibold leading-tight text-ink transition-colors group-hover:text-ink-vivid">{cardTitle}</span>
                  <span className="mt-0.5 text-[11px] leading-none text-ink-muted">{card.scope}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center text-ink-soft transition-transform group-hover:-translate-y-0.5 group-hover:text-ink">
                <LuChevronUp className="size-3.5" aria-hidden="true" />
              </div>
            </button>
          </div>

          {/* Keyframes for Dealing Downwards and Gathering Upwards */}
          <style>{`
            @keyframes workdeskCardDeal {
              0% {
                opacity: 0;
                transform: translateY(-24px) scale(0.96);
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
                transform: translateY(-20px) scale(0.96);
              }
            }
          `}</style>

          {/* Dealing Cards List (Directly below top card) */}
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
            {Object.entries(groupedItems).map(([groupName, items], groupIndex) => {
              const hasActive = items.some((it) => it.id === activeItem?.id)
              return (
                <div
                  key={groupName}
                  style={{
                    animation: isGathering
                      ? 'workdeskCardGather 160ms cubic-bezier(0.4, 0, 0.2, 1) both'
                      : isDealing
                        ? `workdeskCardDeal 240ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(groupIndex, 8) * 35}ms both`
                        : undefined,
                  }}
                  className={cn(
                    'flex shrink-0 flex-col overflow-hidden rounded-xl border bg-panel transition-all shadow-2xs',
                    hasActive ? 'border-accent/40 shadow-xs ring-1 ring-accent/20' : 'border-line/70'
                  )}
                >
                  {/* Project Header */}
                  <div className="flex items-center justify-between border-b border-line/40 bg-panel-2/50 px-2.5 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <LuFolder className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate text-xs font-semibold text-ink" title={groupName}>
                        {groupName}
                      </span>
                    </div>
                    <span className="shrink-0 rounded border border-line/50 bg-panel px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">{items.length}</span>
                  </div>

                  {/* Issues under this Project */}
                  <div className="flex flex-col divide-y divide-line/30 p-1">
                    {items.map((item) => {
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
                          className={cn(
                            'group flex flex-col rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer select-none',
                            isSelected ? 'bg-[#e8f3ef] text-ink dark:bg-emerald-950/50' : 'text-ink-soft hover:bg-panel-2 hover:text-ink',
                            isItemDragging && 'opacity-40 scale-[0.98]',
                            isItemOver && 'ring-1 ring-accent'
                          )}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleSelectItem(item.id)
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <LuGitBranch className={cn('size-3 shrink-0', isSelected ? 'text-accent' : 'text-ink-muted')} aria-hidden="true" />
                              <span className={cn('truncate font-mono text-xs', isSelected ? 'font-bold text-ink' : 'font-medium')}>{item.name}</span>
                            </div>
                            {renderStateDot(item.state)}
                          </div>
                          <span className={cn('mt-1 line-clamp-2 text-[11px] leading-relaxed', isSelected ? 'font-normal text-ink-soft' : 'text-ink-muted')}>{item.summary}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Evidence Details */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-panel-2/20 p-5 lg:p-7">
          {/* Top Header of Right Column */}
          <div className="mb-4 flex max-w-3xl items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Git Workdesk</span>
            <Button
              size="sm"
              variant="default"
              onClick={handleDismissCard}
              className="h-7 gap-1.5 px-2.5 text-xs text-ink-soft hover:border-red-300 hover:text-red-600 dark:hover:border-red-800 dark:hover:text-red-400"
              title={t('workdesk.action.dismiss')}
            >
              <LuTrash2 className="size-3.5" aria-hidden="true" />
              <span>{t('workdesk.action.dismiss')}</span>
            </Button>
          </div>

          {activeItem ? (
            <div className="flex max-w-3xl flex-col gap-4">
              {/* Card 1: 关联项目与目标分支 (Project & Target Ref) */}
              <section className="grid w-full min-w-0 gap-3 rounded-xl border border-line bg-panel p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-3 border-b border-line/50 pb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <LuFolderGit2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    <h3 className="truncate text-xs font-bold text-ink">
                      {activeItem.repoAlias} · {activeItem.name}
                    </h3>
                  </div>
                  {renderStateBadge(activeItem.state)}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Target Project */}
                  <div className="flex flex-col gap-1 rounded-lg border border-line/60 bg-panel-2/40 p-2.5">
                    <span className="text-[11px] font-medium text-ink-muted">{t('workdesk.detail.targetProject')}</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-ink">{activeItem.repoAlias}</span>
                      <Link href={`/git/${encodeURIComponent(activeItem.repoId)}`} className="flex shrink-0 items-center gap-1 text-[11px] text-accent hover:underline">
                        <span>{t('workdesk.detail.openRepo')}</span>
                        <LuExternalLink className="size-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>

                  {/* Target Branch */}
                  <div className="flex flex-col gap-1 rounded-lg border border-line/60 bg-panel-2/40 p-2.5">
                    <span className="text-[11px] font-medium text-ink-muted">{t('workdesk.detail.targetBranch')}</span>
                    <div className="flex items-center gap-1.5">
                      <LuGitBranch className="size-3.5 text-accent" aria-hidden="true" />
                      <span className="font-mono text-xs font-medium text-ink">{activeItem.name}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Card 2: 诊断结论与说明 (Diagnosis & Conclusion) */}
              <section className="grid w-full min-w-0 gap-3 rounded-xl border border-line bg-panel p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-3 border-b border-line/50 pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                      <LuInfo className="size-4 shrink-0 text-accent" aria-hidden="true" />
                      <span>{t('workdesk.evidence.conclusion')}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{t('workdesk.detail.diagnosisDesc')}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-line/60 bg-panel-2/40 p-3.5 text-xs font-medium leading-relaxed text-ink">{activeItem.summary}</div>

                {/* Organization Hygiene Special Action Button */}
                {card.id === 'standard-project-organization' && (
                  <div className="flex flex-col gap-3 rounded-lg border border-[#b5ddd4] bg-[#f4faf7] p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-ink">{t('workdesk.organization.bannerTitle')}</span>
                      <span className="mt-0.5 text-[11px] text-ink-muted">{t('workdesk.organization.bannerDesc')}</span>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('yggit:agent_open', {
                              detail: { prompt: t('workdesk.organization.prompt') },
                            })
                          )
                        }
                      }}
                    >
                      <LuFolderTree className="mr-1.5 size-3.5" aria-hidden="true" />
                      {t('workdesk.organization.bannerAction')}
                    </Button>
                  </div>
                )}
              </section>

              {/* Card 3: 关联 Git 证据与导航 (Git Evidence & Navigation) */}
              <section className="grid w-full min-w-0 gap-3 rounded-xl border border-line bg-panel p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-3 border-b border-line/50 pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                      <LuFileCode className="size-4 shrink-0 text-accent" aria-hidden="true" />
                      <span>{t('workdesk.evidence.title')}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{t('workdesk.detail.evidenceDesc')}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {/* Related Commit */}
                  {activeItem.commit && (
                    <Link
                      href={`/git/${encodeURIComponent(activeItem.repoId)}/commit/${activeItem.commit}`}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-panel p-2.5 transition-colors hover:border-accent hover:bg-panel-2/60 focus-visible:outline-hidden"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <LuGitCommitHorizontal className="size-4 text-accent" aria-hidden="true" />
                        <span className="font-mono text-ink">{t('workdesk.evidence.commit', { oid: activeItem.commit.slice(0, 7) })}</span>
                        <span className="text-ink-muted">({t('workdesk.action.openCommit')})</span>
                      </div>
                      <LuExternalLink className="size-3.5 text-ink-muted group-hover:text-accent" aria-hidden="true" />
                    </Link>
                  )}

                  {/* Related Files & Diff */}
                  {activeItem.paths && activeItem.paths.length > 0
                    ? activeItem.paths.map((filePath) => (
                        <Link
                          key={filePath}
                          href={`/git/${encodeURIComponent(activeItem.repoId)}/commit/${activeItem.commit || 'HEAD'}?file=${encodeURIComponent(filePath)}`}
                          className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-panel p-2.5 transition-colors hover:border-accent hover:bg-panel-2/60 focus-visible:outline-hidden"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <LuFileCode className="size-4 text-accent" aria-hidden="true" />
                            <span className="font-mono text-ink">{t('workdesk.evidence.file', { path: filePath })}</span>
                            <span className="text-ink-muted">({t('workdesk.action.openDiff')})</span>
                          </div>
                          <LuExternalLink className="size-3.5 text-ink-muted group-hover:text-accent" aria-hidden="true" />
                        </Link>
                      ))
                    : null}

                  {!activeItem.commit && (!activeItem.paths || activeItem.paths.length === 0) && (
                    <div className="rounded-lg border border-dashed border-line p-3 text-center text-xs text-ink-muted">{t('workdesk.evidence.noEvidence')}</div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-ink-muted">{t('workdesk.detail.selectPrompt')}</div>
          )}
        </div>
      </div>

      {/* 10-Second Undo Toast */}
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
