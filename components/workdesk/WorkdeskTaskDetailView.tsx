'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
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

  const handleCollapse = () => {
    if (onCollapse) {
      onCollapse()
    } else {
      router.push('/git')
    }
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
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {/* Main Split Layout: Left List + Right Evidence */}
      <div className="flex min-h-0 flex-1 divide-x divide-line">
        {/* Left Column: Task Navigation List */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-line bg-panel-2/30 sm:w-80 lg:w-88">
          {/* Top-Left Small Card (Click to collapse back) */}
          <div className="border-b border-line bg-panel p-2.5">
            <button
              type="button"
              onClick={handleCollapse}
              className="group relative flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-accent/40 bg-[#f4faf7] p-2.5 shadow-2xs transition-all hover:border-accent hover:bg-[#ebf6f1] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
              title={t('workdesk.action.back')}
              aria-label={`${cardTitle} - ${t('workdesk.action.back')}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eef5f2] transition-colors group-hover:bg-[#e2f1ec] dark:bg-emerald-950/60"
                  aria-hidden="true"
                >
                  {resolveCardIcon(card.iconName, card.categoryId)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-xs font-bold text-ink group-hover:text-ink-vivid">{cardTitle}</span>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-accent">
                    <span>{card.scope}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5 group-hover:underline">
                      <LuArrowLeft className="size-2.5" aria-hidden="true" />
                      {t('workdesk.action.back')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center text-accent transition-transform group-hover:-translate-y-0.5">
                <LuChevronUp className="size-4" aria-hidden="true" />
              </div>
            </button>
          </div>

          <div className="flex h-9 shrink-0 items-center justify-between border-b border-line/60 bg-panel/70 px-3.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-ink-soft">{t('workdesk.detail.taskList')}</span>
              <span className="rounded-full border border-line bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">{taskItems.length}</span>
            </div>
            <span className="text-[10px] text-ink-muted">{t('workdesk.scope.projects', { count: Object.keys(groupedItems).length })}</span>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            {Object.entries(groupedItems).map(([groupName, items]) => {
              const hasActive = items.some((it) => it.id === activeItem?.id)
              return (
                <div
                  key={groupName}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-xl border bg-panel transition-all shadow-2xs',
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
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectItem(item.id)}
                          className={cn(
                            'group flex flex-col rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-hidden',
                            isSelected ? 'bg-[#e8f3ef] text-ink dark:bg-emerald-950/50' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <LuGitBranch className={cn('size-3 shrink-0', isSelected ? 'text-accent' : 'text-ink-muted')} aria-hidden="true" />
                              <span className={cn('truncate font-mono text-xs', isSelected ? 'font-bold text-ink' : 'font-medium')}>{item.name}</span>
                            </div>
                            {renderStateDot(item.state)}
                          </div>
                          <span className={cn('mt-1 line-clamp-2 text-[11px] leading-relaxed', isSelected ? 'font-normal text-ink-soft' : 'text-ink-muted')}>{item.summary}</span>
                        </button>
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
