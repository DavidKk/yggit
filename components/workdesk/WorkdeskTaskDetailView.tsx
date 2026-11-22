'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuEllipsis, LuExternalLink, LuFileCode, LuFolderTree, LuGitBranch, LuGitCommitHorizontal, LuTrash2, LuUndo2 } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button } from '@/components/sk'
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
}

export function WorkdeskTaskDetailView({ taskId, initialItemId, initialCard, initialItems = [] }: WorkdeskTaskDetailViewProps) {
  const t = useT()
  const router = useRouter()

  const [card, setCard] = useState<WorkCard | undefined>(initialCard)
  const [itemsMap, setItemsMap] = useState<Record<string, WorkItem>>(() => {
    const map: Record<string, WorkItem> = {}
    for (const item of initialItems) {
      map[item.id] = item
    }
    return map
  })
  const [activeItemId, setActiveItemId] = useState<string>(initialItemId || '')
  const [undoToast, setUndoToast] = useState<{ cardId: string } | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // Listen to engine updates
  useEffect(() => {
    // If card is not provided, load from engine
    const unsubscribe = workdeskEngine.subscribe((result) => {
      const foundCard = result.cards.find((c) => c.id === taskId)
      if (foundCard) {
        setCard(foundCard)
      }
      setItemsMap(result.items)
    })

    if (!card) {
      workdeskEngine.loadInitial().then((cached) => {
        if (cached) {
          const found = cached.cards.find((c) => c.id === taskId)
          if (found) setCard(found)
          setItemsMap(cached.items)
        }
      })
    }

    return () => unsubscribe()
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

  const handleSelectItem = (itemId: string) => {
    setActiveItemId(itemId)
    router.replace(`/workdesk/tasks/${encodeURIComponent(taskId)}/items/${encodeURIComponent(itemId)}`, {
      scroll: false,
    })
  }

  const handleDismissCard = () => {
    if (!card) return
    dismissCard(card.id)
    setUndoToast({ cardId: card.id })
    setShowMoreMenu(false)
  }

  const handleUndoDismiss = (cardId: string) => {
    undoDismissCard(cardId)
    setUndoToast(null)
  }

  // Auto-redirect if dismissed and undo timeout expires
  useEffect(() => {
    if (!undoToast) return
    const timer = setTimeout(() => {
      router.push('/workdesk')
    }, 10000)
    return () => clearTimeout(timer)
  }, [undoToast, router])

  if (!card) {
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Topline Navigation */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-panel px-4">
        <Link href="/git" className="flex items-center gap-1.5 text-xs font-medium text-ink hover:text-accent focus-visible:outline-hidden">
          <LuArrowLeft className="size-3.5" aria-hidden="true" />
          <span>{t('workdesk.action.back')}</span>
        </Link>

        <h2 className="text-xs font-bold text-ink">
          {(() => {
            const i18nKey = CARD_I18N_MAP[card.id]
            const rawTitle = i18nKey ? t(`workdesk.cards.${i18nKey}.title` as MessageKey) : undefined
            return rawTitle && !rawTitle.startsWith('workdesk.cards.') ? rawTitle : card.title
          })()}
        </h2>

        <span className="text-[10px] font-medium text-ink-muted">Git Workdesk</span>
      </div>

      {/* Main Split Layout: Left List + Right Evidence */}
      <div className="flex min-h-0 flex-1 divide-x divide-line">
        {/* Left Column: Task Navigation List */}
        <div className="flex w-64 shrink-0 flex-col overflow-y-auto bg-panel-2/30 sm:w-72">
          <div className="px-3.5 py-2.5 text-[11px] font-semibold text-ink-muted">任务列表 ({taskItems.length})</div>

          <div className="flex flex-col gap-3 px-2 pb-4">
            {Object.entries(groupedItems).map(([groupName, items]) => (
              <div key={groupName} className="flex flex-col">
                <div className="px-2 py-1 text-[11px] font-medium text-ink-muted">{groupName}</div>
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const isSelected = item.id === activeItem?.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectItem(item.id)}
                        className={cn(
                          'flex flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors focus-visible:outline-hidden',
                          isSelected ? 'bg-[#e8f3ef] text-ink dark:bg-emerald-950/40' : 'hover:bg-panel-2 text-ink-soft hover:text-ink'
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={cn('truncate text-xs', isSelected ? 'font-semibold text-ink' : 'font-normal')}>{item.name}</span>
                          {renderStateDot(item.state)}
                        </div>
                        <span className="mt-0.5 truncate text-[11px] text-ink-muted">{item.summary}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Evidence Details */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-panel p-5 lg:p-7">
          {activeItem ? (
            <div className="flex max-w-2xl flex-col gap-5">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <LuGitBranch className="size-4 text-accent" aria-hidden="true" />
                  <span className="text-sm font-bold text-ink">
                    {activeItem.repoAlias} · {activeItem.name}
                  </span>
                </div>
                {renderStateBadge(activeItem.state)}
              </div>

              {/* Conclusion Statement */}
              <div className="rounded-xl border border-line bg-panel-2/40 p-3.5">
                <span className="text-[11px] font-semibold text-ink-muted">{t('workdesk.evidence.conclusion')}</span>
                <p className="mt-1 text-xs font-medium text-ink">{activeItem.summary}</p>
              </div>

              {/* Organization Hygiene Special Action Button */}
              {card.id === 'standard-project-organization' && (
                <div className="flex flex-col gap-3 rounded-xl border border-[#b5ddd4] bg-[#f4faf7] p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/40 dark:bg-emerald-950/20">
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

              {/* Navigable Git Evidence List */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-ink-muted">{t('workdesk.evidence.title')}</span>

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
              </div>

              {/* Bottom Assistance & More Actions */}
              <div className="mt-8 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
                <span>{t('workdesk.agent.prompt')}</span>

                <div className="relative">
                  <Button size="sm" variant="ghost" onClick={() => setShowMoreMenu(!showMoreMenu)} aria-label="更多操作">
                    <LuEllipsis className="size-4" aria-hidden="true" />
                  </Button>

                  {showMoreMenu && (
                    <div className="absolute right-0 bottom-full mb-1 w-44 rounded-lg border border-line bg-panel p-1 shadow-lg">
                      <button
                        onClick={handleDismissCard}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <LuTrash2 className="size-3.5" aria-hidden="true" />
                        <span>{t('workdesk.action.dismiss')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-ink-muted">请在左侧选择要查看的子任务</div>
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
