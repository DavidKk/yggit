'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LuArrowLeft,
  LuBot,
  LuChevronUp,
  LuExternalLink,
  LuFileCode,
  LuFolderGit2,
  LuFolderTree,
  LuGitBranch,
  LuGitCommitHorizontal,
  LuGitFork,
  LuInfo,
  LuTrash2,
  LuUndo2,
} from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Tooltip } from '@/components/sk'
import { setWorkdeskContext } from '@/lib/agent/workdesk-context'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { workdeskEngine } from '@/lib/workdesk/engine'
import { dismissCard, undoDismissCard } from '@/lib/workdesk/storage'
import type { WorkCard, WorkItem } from '@/lib/workdesk/types'

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

  const parsedCount = parseInt(card?.scope.match(/(\d+)\s*个项目/)?.[1] || card?.scope.match(/(\d+)/)?.[1] || '1', 10)
  const projectCount = card?.projectCount !== undefined ? card.projectCount : parsedCount
  const displayProjectCount = projectCount > 99 ? '99+' : projectCount

  const extraMeta = useMemo(() => {
    if (!card) return null
    const worktreeMatch = card.scope.match(/(\d+)\s*Worktrees/i)
    if (worktreeMatch) {
      const count = parseInt(worktreeMatch[1], 10)
      return {
        icon: <LuGitFork className="size-3 text-ink-muted" aria-hidden="true" />,
        display: count > 99 ? '99+' : count,
        title: `${count} Worktrees`,
      }
    }

    const branchMatch = card.scope.match(/(\d+)\s*个分支/i) || card.scope.match(/(\d+)\s*分支/i)
    if (branchMatch) {
      const count = parseInt(branchMatch[1], 10)
      return {
        icon: <LuGitBranch className="size-3 text-ink-muted" aria-hidden="true" />,
        display: count > 99 ? '99+' : count,
        title: `${count} 个分支`,
      }
    }

    if (card.itemIds && card.itemIds.length > 0 && card.id.includes('branch')) {
      const count = card.itemIds.length
      return {
        icon: <LuGitBranch className="size-3 text-ink-muted" aria-hidden="true" />,
        display: count > 99 ? '99+' : count,
        title: `${count} 个分支`,
      }
    }

    return null
  }, [card])

  const handleSendToAgent = useCallback(
    (item?: WorkItem) => {
      const target = item || activeItem
      if (!target || !card) return
      const commitEvidence = target.commit ? `\n- 关联提交: ${target.commit}` : ''
      const pathEvidence = target.paths && target.paths.length > 0 ? `\n- 关联路径: ${target.paths.join(', ')}` : ''
      const prompt = `请协助处理工作台任务【${cardTitle}】：
- 目标项目: ${target.repoAlias || target.repoId}
- 目标分支: ${target.name}
- 诊断结论: ${target.summary}${commitEvidence}${pathEvidence}

请分析具体情况并给出处理建议或执行方案。`

      const refTitle = target.repoAlias ? `${cardTitle} · ${target.repoAlias}` : cardTitle

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('yggit:agent_open', {
            detail: {
              reference: {
                title: refTitle,
                prompt,
              },
            },
          })
        )
      }
    },
    [activeItem, card, cardTitle]
  )

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
                'group relative flex min-h-[58px] w-full cursor-pointer flex-col justify-center rounded-xl border border-line bg-panel p-2.5 shadow-xs transition-all duration-150',
                'hover:border-[#b5ddd4] hover:bg-[#f8fcfa] hover:shadow-sm dark:hover:border-emerald-700/50 dark:hover:bg-emerald-950/20',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40'
              )}
              title={t('workdesk.action.back')}
              aria-label={`${cardTitle} - ${t('workdesk.action.back')}`}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-ink transition-colors group-hover:text-ink-vivid">{cardTitle}</span>
                <div className="flex shrink-0 items-center text-ink-soft transition-transform group-hover:-translate-y-0.5 group-hover:text-ink">
                  <LuChevronUp className="size-3.5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-ink-muted">
                <Tooltip content={`涉及 ${projectCount} 个项目`} placement="top">
                  <span className="inline-flex items-center gap-1 cursor-default">
                    <LuFolderGit2 className="size-3 text-ink-muted" aria-hidden="true" />
                    <span>{displayProjectCount}</span>
                    <span className="sr-only">{projectCount} 个项目</span>
                  </span>
                </Tooltip>
                {extraMeta && (
                  <Tooltip content={extraMeta.title} placement="top">
                    <span className="inline-flex items-center gap-1 cursor-default">
                      {extraMeta.icon}
                      <span>{extraMeta.display}</span>
                    </span>
                  </Tooltip>
                )}
              </div>
            </button>
          </div>

          {/* Keyframes for Dealing Downwards and Gathering Upwards */}
          <style>{`
            @keyframes workdeskCardDeal {
              0% {
                opacity: 0.6;
                transform: translateY(-10px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes workdeskCardGather {
              0% {
                opacity: 1;
                transform: translateY(0);
              }
              100% {
                opacity: 0.5;
                transform: translateY(-10px);
              }
            }
          `}</style>

          {/* Dealing Cards List (Directly below top card) */}
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
            {taskItems.map((item, itemIndex) => {
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
                      ? 'workdeskCardGather 160ms cubic-bezier(0.4, 0, 0.2, 1) both'
                      : isDealing
                        ? `workdeskCardDeal 240ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(itemIndex, 8) * 35}ms both`
                        : undefined,
                  }}
                  className={cn(
                    'group relative flex min-h-[58px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 shadow-xs transition-all duration-150 select-none shrink-0',
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
                  <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                    <span className="line-clamp-1 text-xs font-semibold leading-tight text-ink transition-colors group-hover:text-ink-vivid">
                      {item.repoAlias ? `${item.repoAlias} · ${item.name}` : item.name}
                    </span>
                    <span className="mt-1 line-clamp-1 text-[11px] leading-none text-ink-muted">{item.summary}</span>
                  </div>

                  {/* Right Status Dot & Agent Quick Action */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Tooltip content="引用到 Git Agent" placement="top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSendToAgent(item)
                        }}
                        className="flex size-5 items-center justify-center rounded-md text-ink-muted opacity-0 group-hover:opacity-100 hover:bg-accent/15 hover:text-accent transition-all duration-150 cursor-pointer"
                        aria-label="引用到 Git Agent"
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
          </div>
        </div>

        {/* Right Column: Evidence Details */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-panel-2/20 p-5 lg:p-7">
          {/* Top Header of Right Column */}
          <div className="mb-4 flex max-w-3xl items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Git Workdesk</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleSendToAgent()}
                className="h-7 gap-1.5 px-2.5 text-xs text-accent hover:border-accent/40 hover:bg-accent/10"
                title={t('workdesk.action.sendToAgent')}
              >
                <LuBot className="size-3.5" aria-hidden="true" />
                <span>{t('workdesk.action.sendToAgent')}</span>
              </Button>
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

                {/* Agent Assist Quick Action */}
                {card.id !== 'standard-project-organization' && (
                  <div className="flex flex-col gap-3 rounded-lg border border-[#b5ddd4] bg-[#f4faf7] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex min-w-0 flex-1 flex-col pr-3">
                      <span className="text-xs font-semibold text-ink">由 Git Agent 协助处理此任务</span>
                      <span className="mt-0.5 text-[11px] text-ink-muted">一键将项目诊断与分支状态带入 Agent 进行自动化合并、变基或规范整理</span>
                    </div>
                    <Button size="sm" className="shrink-0 gap-1.5" onClick={() => handleSendToAgent()}>
                      <LuBot className="size-3.5" aria-hidden="true" />
                      <span>{t('workdesk.action.sendToAgent')}</span>
                    </Button>
                  </div>
                )}

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
