'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuBot, LuChevronUp, LuExternalLink, LuFileCode, LuFolderGit2, LuFolderTree, LuGitBranch, LuGitCommitHorizontal, LuGitFork } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Tooltip } from '@/components/sk'
import { setWorkdeskContext } from '@/lib/agent/workdesk-context'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { workdeskEngine } from '@/lib/workdesk/engine'
import type { WorkCard, WorkItem } from '@/lib/workdesk/types'

const CARD_I18N_MAP: Record<string, string> = {
  'sync-default-branches': 'syncDefaultBranches',
  'worktree-parallel-dev': 'worktreeParallelDev',
  'merge-diverged-branches': 'mergeDivergedBranches',
  'standard-repo-hygiene': 'standardRepoHygiene',
  'standard-project-organization': 'standardProjectOrganization',
  'review-pending-commits': 'reviewPendingCommits',
}

interface CrAnalysis {
  cause: string
  risk: string
  suggestion: string
}

function getCrAnalysis(cardId: string, _item: WorkItem): CrAnalysis {
  if (cardId === 'merge-diverged-branches' || cardId.includes('merge')) {
    return {
      cause: '本地分支存在未推送的提交，同时远端主分支已被他人合并推进，导致两端基于不同的提交基线产生了分叉。',
      risk: '若直接强制推送会导致远端他人提交丢失；若长期搁置不合流，代码差异与潜在冲突面积将持续扩大，增加后续合并回归难度。',
      suggestion: '建议拉取远端最新提交后执行变基 (git rebase) 或合并 (git merge)，解决潜在冲突并在验证通过后推送到远端。',
    }
  }

  if (cardId === 'sync-default-branches' || cardId.includes('sync')) {
    return {
      cause: '远端默认分支已有团队新功能或热修复代码合并入库，本地默认分支当前落后于远端。',
      risk: '在陈旧的主分支基线上切出新分支开发，可能导致基于已废弃代码开发，后续提 PR 时会产生不必要的大量基线冲突。',
      suggestion: '建议在当前默认分支上执行安全快进拉取 (git pull --ff-only) 同步至最新状态。',
    }
  }

  if (cardId === 'worktree-parallel-dev' || cardId.includes('worktree')) {
    return {
      cause: '先前为并行处理多需求或紧急补丁建立了独立 Worktree 工作树，在任务结束后未被及时注销或收拢。',
      risk: '多工作树持续占用磁盘空间与 Git 内部分支锁；长时间闲置容易导致在过期工作目录中误改代码或误提变更。',
      suggestion: '建议检查各个独立工作树的代码交付状态，若已合并上线请及时注销移除，保持工作区干净清爽。',
    }
  }

  if (cardId === 'standard-repo-hygiene' || cardId.includes('hygiene') || cardId.includes('standard')) {
    return {
      cause: '当前分支命名未遵循团队约定的规范格式（如缺少 feature/、hotfix/、bugfix/ 前缀或工单 ID）。',
      risk: '非标准命名会导致 CI/CD 自动化构建、发布流水线或敏捷看板无法自动关联追踪任务，增加发布管理和代码审计成本。',
      suggestion: '建议按照团队研发规范将分支重命名为标准格式（例如 feature/JZY-xxx）。',
    }
  }

  if (cardId === 'standard-project-organization' || cardId.includes('organization')) {
    return {
      cause: '单一分组或根目录下累积了过多仓库，缺乏按业务域、微服务或 SDK 的分层分类。',
      risk: '团队多仓库并行协作时检索成本高，批量更新或检查时缺乏清晰边界，容易引发误操作或权限混乱。',
      suggestion: '建议使用 Git Agent 按业务模块或应用形态进行智能分类分组治理。',
    }
  }

  if (cardId === 'code-review-pending-push' || cardId.includes('review') || cardId.includes('push')) {
    return {
      cause: '本地已生成新提交或存在已暂存变更，但尚未同步推送至远端托管平台。',
      risk: '未推送的代码仅存在于本地机器，存在单点丢失风险；其他协作者无法感知你当前的开发进展，可能引发重复开发。',
      suggestion: '建议复核改动提交记录与文件差异，确认无误后及时推送到对应远端分支。',
    }
  }

  return {
    cause: '检测到本地工作区或分支状态与预期的协同规范存在偏差。',
    risk: '未及时处理可能在后续集成构建或团队协作时产生阻碍。',
    suggestion: '请参考检查结论进行复核并执行相应同步或合流操作。',
  }
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
    }, 220)
  }, [isGathering, onCollapse, router])

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
      <div className="flex min-h-0 flex-1">
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
                opacity: 0;
                transform: translateY(-14px) scale(0.97);
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
                transform: translateY(-24px) scale(0.92);
              }
            }
          `}</style>

          {/* Dealing Cards List (Directly below top card) */}
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 pb-20">
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
                      ? `workdeskCardGather 180ms cubic-bezier(0.4, 0, 0.2, 1) ${Math.min(itemIndex, 5) * 10}ms both`
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

        {/* Right Column: Evidence Details (Single Unified Block) */}
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-panel-2/20 p-2.5 pb-20 transition-opacity duration-200',
            isGathering ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
        >
          {activeItem ? (
            <div className="w-full max-w-3xl rounded-xl border border-line bg-panel p-4 shadow-2xs sm:p-5">
              {/* Header: Title + Status Badge */}
              <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <LuFolderGit2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  <h3 className="truncate text-sm font-bold text-ink">
                    {activeItem.repoAlias} · {activeItem.name}
                  </h3>
                </div>
                {renderStateBadge(activeItem.state)}
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {/* 1. 关联项目 & 问题分支 - 均单独一行展示 */}
                <div className="flex flex-col gap-2 rounded-lg border border-line/60 bg-panel-2/40 p-3 text-xs">
                  {/* Row 1: 关联项目 */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="w-20 shrink-0 text-[11px] font-medium text-ink-muted">{t('workdesk.detail.targetProject')}</span>
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate font-semibold text-ink">{activeItem.repoAlias}</span>
                      <Link href={`/git/${encodeURIComponent(activeItem.repoId)}`} className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                        <span>{t('workdesk.detail.openRepo')}</span>
                        <LuExternalLink className="size-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>

                  <div className="h-px bg-line/40" />

                  {/* Row 2: 问题分支 (单独一行，长名称不被挤压) */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="w-20 shrink-0 text-[11px] font-medium text-ink-muted">{t('workdesk.detail.problemBranch')}</span>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <LuGitBranch className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <span className="font-mono text-xs font-medium text-ink break-all select-all">{activeItem.name}</span>
                    </div>
                  </div>
                </div>

                {/* 2. 问题描述 */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('workdesk.detail.problemDesc')}</span>
                  <div className="rounded-lg border border-line/60 bg-panel-2/30 p-3 text-xs font-medium leading-relaxed text-ink">{activeItem.summary}</div>
                </div>

                {/* 3. CR 成因分析与潜在影响 (类似 CR 代码审查) */}
                {(() => {
                  const cr = getCrAnalysis(card.id, activeItem)
                  return (
                    <div className="flex flex-col gap-3 rounded-lg border border-line/70 bg-panel-2/40 p-3.5">
                      {/* 产生原因 */}
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                          <span className="size-1.5 rounded-full bg-accent" />
                          {t('workdesk.detail.causeTitle')}
                        </span>
                        <p className="pl-3 text-xs leading-relaxed text-ink-soft">{cr.cause}</p>
                      </div>

                      {/* 潜在风险 */}
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          {t('workdesk.detail.riskTitle')}
                        </span>
                        <p className="pl-3 text-xs leading-relaxed text-ink-soft">{cr.risk}</p>
                      </div>

                      {/* 处理建议 */}
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#28a388]">
                          <span className="size-1.5 rounded-full bg-[#28a388]" />
                          {t('workdesk.detail.suggestionTitle')}
                        </span>
                        <p className="pl-3 text-xs leading-relaxed text-ink-soft">{cr.suggestion}</p>
                      </div>
                    </div>
                  )
                })()}

                {/* 4. 由 Git Agent 协助处理此任务 */}
                {card.id !== 'standard-project-organization' ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-[#b5ddd4] bg-[#f4faf7] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex min-w-0 flex-1 flex-col pr-3">
                      <span className="text-xs font-semibold text-ink">{t('workdesk.detail.agentAssistTitle')}</span>
                      <span className="mt-0.5 text-[11px] text-ink-muted">{t('workdesk.detail.agentAssistDesc')}</span>
                    </div>
                    <Button size="sm" className="shrink-0 gap-1.5" onClick={() => handleSendToAgent()}>
                      <LuBot className="size-3.5" aria-hidden="true" />
                      <span>{t('workdesk.action.sendToAgent')}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-[#b5ddd4] bg-[#f4faf7] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/40 dark:bg-emerald-950/20">
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

                {/* 5. 关联 Git 证据与导航 (如果有提交或文件差异) */}
                {(activeItem.commit || (activeItem.paths && activeItem.paths.length > 0)) && (
                  <div className="flex flex-col gap-2 border-t border-line/60 pt-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('workdesk.evidence.title')}</span>
                    <div className="flex flex-col gap-2">
                      {activeItem.commit && (
                        <Link
                          href={`/git/${encodeURIComponent(activeItem.repoId)}/commit/${activeItem.commit}`}
                          className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2/40 p-2.5 transition-colors hover:border-accent hover:bg-panel-2/70 focus-visible:outline-hidden"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <LuGitCommitHorizontal className="size-4 text-accent" aria-hidden="true" />
                            <span className="font-mono text-ink">{t('workdesk.evidence.commit', { oid: activeItem.commit.slice(0, 7) })}</span>
                            <span className="text-ink-muted">({t('workdesk.action.openCommit')})</span>
                          </div>
                          <LuExternalLink className="size-3.5 text-ink-muted group-hover:text-accent" aria-hidden="true" />
                        </Link>
                      )}
                      {activeItem.paths &&
                        activeItem.paths.length > 0 &&
                        activeItem.paths.map((filePath) => (
                          <Link
                            key={filePath}
                            href={`/git/${encodeURIComponent(activeItem.repoId)}/commit/${activeItem.commit || 'HEAD'}?file=${encodeURIComponent(filePath)}`}
                            className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2/40 p-2.5 transition-colors hover:border-accent hover:bg-panel-2/70 focus-visible:outline-hidden"
                          >
                            <div className="flex items-center gap-2 text-xs">
                              <LuFileCode className="size-4 text-accent" aria-hidden="true" />
                              <span className="font-mono text-ink">{t('workdesk.evidence.file', { path: filePath })}</span>
                              <span className="text-ink-muted">({t('workdesk.action.openDiff')})</span>
                            </div>
                            <LuExternalLink className="size-3.5 text-ink-muted group-hover:text-accent" aria-hidden="true" />
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-ink-muted">{t('workdesk.detail.selectPrompt')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
