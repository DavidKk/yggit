'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuBot, LuFolderArchive, LuFolderGit2, LuFolderTree, LuGitBranch, LuX } from 'react-icons/lu'

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
  solution: string
}

function getCrAnalysis(cardId: string, _item: WorkItem): CrAnalysis {
  if (cardId === 'merge-diverged-branches' || cardId.includes('merge')) {
    return {
      cause: '本地分支存在未推送的提交，同时远端主分支已被他人合并推进，导致两端基于不同的提交基线产生了分叉。',
      risk: '若直接强制推送会导致远端他人提交丢失；若长期搁置不合流，代码差异与潜在冲突面积将持续扩大，增加后续合并回归难度。',
      suggestion: '建议拉取远端最新提交后执行变基 (git rebase) 或合并 (git merge)，解决潜在冲突并在验证通过后推送到远端。',
      solution:
        '1. 拉取远端主干最新变更：git fetch origin\n2. 推荐执行变基合流以保持提交历史线性整洁：git rebase origin/<targetBranch>（若存在冲突则比对解决后执行 git rebase --continue）\n3. 本地构建与验证通过后推送到远端仓库。',
    }
  }

  if (cardId === 'sync-default-branches' || cardId.includes('sync')) {
    return {
      cause: '远端默认分支已有团队新功能或热修复代码合并入库，本地默认分支当前落后于远端。',
      risk: '在陈旧的主分支基线上切出新分支开发，可能导致基于已废弃代码开发，后续提 PR 时会产生不必要的大量基线冲突。',
      suggestion: '建议在当前默认分支上执行安全快进拉取 (git pull --ff-only) 同步至最新状态。',
      solution: '1. 确认本地工作目录干净（无未提交的改动）\n2. 切换至默认分支执行安全快进拉取：git pull --ff-only\n3. 若存在不可快进的本地私有改动，创建特性分支隔离后再拉取。',
    }
  }

  if (cardId === 'worktree-parallel-dev' || cardId.includes('worktree')) {
    return {
      cause: '先前为并行处理多需求或紧急补丁建立了独立 Worktree 工作树，在任务结束后未被及时注销或收拢。',
      risk: '多工作树持续占用磁盘空间与 Git 内部分支锁；长时间闲置容易导致在过期工作目录中误改代码或误提变更。',
      suggestion: '建议检查各个独立工作树的代码交付状态，若已合并上线请及时注销移除，保持工作区干净清爽。',
      solution:
        '1. 检查各个独立 Worktree 目录中的开发进度与未提交文件\n2. 对已完成交付的 Worktree 执行移除清理：git worktree remove <path>\n3. 运行 git worktree prune 清除失效的元数据引用。',
    }
  }

  if (cardId === 'standard-repo-hygiene' || cardId.includes('hygiene') || cardId.includes('standard')) {
    return {
      cause: '当前分支命名未遵循团队约定的规范格式（如缺少 feature/、hotfix/、bugfix/ 前缀或工单 ID）。',
      risk: '非标准命名会导致 CI/CD 自动化构建、发布流水线或敏捷看板无法自动关联追踪任务，增加发布管理和代码审计成本。',
      suggestion: '建议按照团队研发规范将分支重命名为标准格式（例如 feature/JZY-xxx）。',
      solution:
        '1. 确认当前分支对应的需求或工单编号（如 JZY-xxx）\n2. 使用标准研发前缀重命名本地分支：git branch -m <oldBranch> feature/<ticket>-<desc>\n3. 推送新规范分支至远端并建立跟踪，清理旧的非规范分支。',
    }
  }

  if (cardId === 'standard-project-organization' || cardId.includes('organization')) {
    return {
      cause: '单一分组或根目录下累积了过多仓库，缺乏按业务域、微服务或 SDK 的分层分类。',
      risk: '团队多仓库并行协作时检索成本高，批量更新或检查时缺乏清晰边界，容易引发误操作或权限混乱。',
      suggestion: '建议使用 Git Agent 按业务模块或应用形态进行智能分类分组治理。',
      solution: '1. 梳理当前分组中的仓库业务域（如核心后端、Web 前端、公用 SDK、运维脚本）\n2. 规划子分组层级并在工作台设置中执行批量归类整理。',
    }
  }

  if (cardId === 'code-review-pending-push' || cardId.includes('review') || cardId.includes('push')) {
    return {
      cause: '本地已生成新提交或存在已暂存变更，但尚未同步推送至远端托管平台。',
      risk: '未推送的代码仅存在于本地机器，存在单点丢失风险；其他协作者无法感知你当前的开发进展，可能引发重复开发。',
      suggestion: '建议复核改动提交记录与文件差异，确认无误后及时推送到对应远端分支。',
      solution:
        '1. 复核本地未推送的提交记录：git log origin/<branch>..HEAD\n2. 检查暂存区与未暂存改动，确保敏感信息或临时调试代码已剔除\n3. 验证通过后推送到远端：git push origin <branch>。',
    }
  }

  return {
    cause: '检测到本地工作区或分支状态与预期的协同规范存在偏差。',
    risk: '未及时处理可能在后续集成构建或团队协作时产生阻碍。',
    suggestion: '请参考检查结论进行复核并执行相应同步或合流操作。',
    solution: '拉取远端状态，核对差异并执行合流或规范调整。',
  }
}

function getItemCardSummary(summary: string): string {
  const aheadBehindMatch = summary.match(/(领先\s*\d+\s*\/\s*落后\s*\d+)/)
  if (aheadBehindMatch) {
    return aheadBehindMatch[1]
  }
  const aheadMatch = summary.match(/(领先\s*\d+)/)
  if (aheadMatch) {
    return aheadMatch[1]
  }
  const behindMatch = summary.match(/(落后\s*\d+)/)
  if (behindMatch) {
    return behindMatch[1]
  }
  const firstClause = summary.split(/[，,。；;]/)[0]?.trim()
  return firstClause || summary
}

function getItemProblemTitle(cardId: string, item: WorkItem, t: (key: MessageKey) => string): string {
  if (cardId === 'merge-diverged-branches' || cardId.includes('merge')) {
    return t('workdesk.problemTitles.merge' as MessageKey)
  }
  if (cardId === 'sync-default-branches' || cardId.includes('sync')) {
    return t('workdesk.problemTitles.sync' as MessageKey)
  }
  if (cardId === 'worktree-parallel-dev' || cardId.includes('worktree')) {
    return t('workdesk.problemTitles.worktree' as MessageKey)
  }
  if (cardId === 'standard-repo-hygiene' || cardId.includes('hygiene') || cardId.includes('standard')) {
    return t('workdesk.problemTitles.standard' as MessageKey)
  }
  if (cardId === 'standard-project-organization' || cardId.includes('organization')) {
    return t('workdesk.problemTitles.organization' as MessageKey)
  }
  if (cardId === 'code-review-pending-push' || cardId.includes('review') || cardId.includes('push')) {
    return t('workdesk.problemTitles.review' as MessageKey)
  }
  const firstClause = item.summary.split(/[，,。；;]/)[0]?.trim()
  return firstClause || t('workdesk.problemTitles.default' as MessageKey)
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

  const handleSendToAgent = useCallback(
    (item?: WorkItem) => {
      const target = item || activeItem
      if (!target || !card) return
      const cr = getCrAnalysis(card.id, target)
      const prompt = `请协助处理工作台任务【${cardTitle}】：
- 目标项目: ${target.repoAlias || target.repoId}
- 目标分支: ${target.name}
- 问题描述: ${target.summary}
- 产生原因: ${cr.cause}
- 潜在风险: ${cr.risk}
- 推荐解决方案:
${cr.solution}

请参考上述推荐解决方案，协助执行或自动化处理此任务。`

      const refTitle = target.repoAlias ? `${cardTitle} · ${target.repoAlias}` : cardTitle

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('yggit:agent_open', {
            detail: {
              reference: {
                title: refTitle,
                taskId: card.id,
                itemId: target.id,
                repoId: target.repoId,
                repoAlias: target.repoAlias,
                branch: target.name,
                summary: target.summary,
                solution: cr.solution,
              },
              prompt,
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
    if (state === 'safe') return <span className="h-3.5 w-1 shrink-0 rounded-full bg-[#28a388]" aria-hidden="true" />
    if (state === 'warn') return <span className="h-3.5 w-1 shrink-0 rounded-full bg-[#d8a646]" aria-hidden="true" />
    return <span className="h-3.5 w-1 shrink-0 rounded-full bg-[#d96c61]" aria-hidden="true" />
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
          {/* Top-Left Task Set Bar (Clean non-card header so first task item is the real card) */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 bg-panel-2/60 select-none">
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
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-ink-muted hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-500 active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40"
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
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-20">
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
                    <span className="mt-1 line-clamp-1 text-[11px] leading-none text-ink-muted">{getItemCardSummary(item.summary)}</span>
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
            'relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-panel-2/20 p-3 pb-20 transition-opacity duration-200',
            isGathering ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
        >
          {activeItem ? (
            <div className="w-full max-w-4xl rounded-xl border border-line bg-panel p-3.5 shadow-2xs">
              {/* Header: Title + Status Badge */}
              <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <LuFolderGit2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  <h3 className="truncate text-sm font-bold text-ink">{getItemProblemTitle(card.id, activeItem, t)}</h3>
                </div>
                {renderStateBadge(activeItem.state)}
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {/* 1. 关联项目 & 问题分支 - 均单独一行展示，点击名称直接进入 */}
                <div className="flex flex-col gap-2 rounded-lg border border-line/60 bg-panel-2/40 p-3 text-xs">
                  {/* Row 1: 关联项目 (点击直接进入) */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="w-20 shrink-0 text-[11px] font-medium text-ink-muted">{t('workdesk.detail.targetProject')}</span>
                    <div className="flex min-w-0 flex-1 items-center">
                      <Link
                        href={`/git/${encodeURIComponent(activeItem.repoId)}`}
                        className="truncate font-semibold text-ink hover:text-accent hover:underline transition-colors"
                        title={activeItem.repoAlias}
                      >
                        {activeItem.repoAlias}
                      </Link>
                    </div>
                  </div>

                  <div className="h-px bg-line/40" />

                  {/* Row 2: 问题分支 (单独一行，点击直接进入) */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="w-20 shrink-0 text-[11px] font-medium text-ink-muted">{t('workdesk.detail.problemBranch')}</span>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Link
                        href={`/git/${encodeURIComponent(activeItem.repoId)}/branch/${encodeURIComponent(activeItem.name)}`}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-ink hover:text-accent hover:underline transition-colors break-all select-all"
                        title={activeItem.name}
                      >
                        <LuGitBranch className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                        <span>{activeItem.name}</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* 2. CR 诊断分析 (类似 CR 代码审查：问题描述、产生原因、潜在风险、解决方案) */}
                {(() => {
                  const cr = getCrAnalysis(card.id, activeItem)
                  return (
                    <div className="flex flex-col gap-3 rounded-lg border border-line/70 bg-panel-2/40 p-3.5">
                      {/* 问题描述 */}
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                          <span className="size-1.5 rounded-full bg-accent" />
                          {t('workdesk.detail.problemDesc')}
                        </span>
                        <p className="pl-3 text-xs font-medium leading-relaxed text-ink">{activeItem.summary}</p>
                      </div>

                      {/* 产生原因 */}
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
                          <span className="size-1.5 rounded-full bg-line-contrast" />
                          {t('workdesk.detail.causeTitle')}
                        </span>
                        <p className="pl-3 text-xs leading-relaxed text-ink-muted">{cr.cause}</p>
                      </div>

                      {/* 潜在风险 */}
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          {t('workdesk.detail.riskTitle')}
                        </span>
                        <p className="pl-3 text-xs leading-relaxed text-ink-muted">{cr.risk}</p>
                      </div>

                      {/* 解决方案 */}
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#28a388]">
                          <span className="size-1.5 rounded-full bg-[#28a388]" />
                          {t('workdesk.detail.solutionTitle')}
                        </span>
                        <div className="ml-3 whitespace-pre-line rounded-md border border-line/60 bg-panel/60 p-2.5 text-xs leading-relaxed text-ink font-mono">{cr.solution}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* 3. 由 Git Agent 协助处理此任务 (参考上述解决方案执行) */}
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
