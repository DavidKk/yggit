'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'
import { LuBot, LuFolderGit2, LuGitBranch, LuGitFork } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { quoteWorkdeskTaskToAgent } from '@/lib/agent/agent-quote'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { WorkCard } from '@/lib/workdesk/types'

interface WorkdeskCardProps {
  card: WorkCard
  className?: string
  noWrapperMargin?: boolean
  onSelect?: (cardId: string, element?: HTMLElement) => void
}

export const CARD_I18N_MAP: Record<string, string> = {
  'sync-default-branches': 'syncDefaultBranches',
  'worktree-parallel-dev': 'worktreeParallelDev',
  'merge-diverged-branches': 'mergeDivergedBranches',
  'standard-repo-hygiene': 'standardRepoHygiene',
  'standard-project-organization': 'standardProjectOrganization',
  'review-pending-commits': 'reviewPendingCommits',
}

export function WorkdeskCard({ card, className, noWrapperMargin = false, onSelect }: WorkdeskCardProps) {
  const t = useT()

  const i18nKey = CARD_I18N_MAP[card.id]
  const rawTitle = i18nKey ? t(`workdesk.cards.${i18nKey}.title` as MessageKey) : undefined
  const title = rawTitle && !rawTitle.startsWith('workdesk.cards.') ? rawTitle : card.title

  const parsedCount = parseInt(card.scope.match(/(\d+)\s*个项目/)?.[1] || card.scope.match(/(\d+)/)?.[1] || '1', 10)
  const projectCount = card.projectCount !== undefined ? card.projectCount : parsedCount
  const displayProjectCount = projectCount > 99 ? '99+' : projectCount
  const isMultiple = projectCount > 1

  const extraMeta = useMemo(() => {
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
  }, [card.scope, card.id, card.itemIds])

  return (
    <div
      className={cn('group/stack relative transition-all duration-200 select-none', !noWrapperMargin && (isMultiple ? 'mb-2.5 pb-0.5' : 'mb-1'))}
      data-testid={`workdesk-card-wrapper-${card.id}`}
      data-stacked={isMultiple ? 'true' : 'false'}
    >
      {/* Visual metaphor for multiple projects: pure white card deck with subtle corner peeking out */}
      {isMultiple && (
        <>
          {/* Deepest underlayer (layer 3, subtle second white corner peek) */}
          <div
            data-testid="card-stack-layer-bottom"
            className={cn(
              'absolute inset-0 rounded-xl border border-line/60 bg-panel shadow-2xs transition-all duration-200 pointer-events-none origin-top-left',
              'translate-x-1.5 translate-y-1.5 rotate-[1.2deg]',
              'group-hover/stack:translate-x-2 group-hover/stack:translate-y-2 group-hover/stack:rotate-[1.8deg]',
              'dark:border-line/40 dark:bg-panel'
            )}
            aria-hidden="true"
          />
          {/* Middle underlayer (layer 2, crisp white corner peek) */}
          <div
            data-testid="card-stack-layer-middle"
            className={cn(
              'absolute inset-0 rounded-xl border border-line/80 bg-panel shadow-2xs transition-all duration-200 pointer-events-none origin-top-left',
              'translate-x-1 translate-y-1 rotate-[0.6deg]',
              'group-hover/stack:translate-x-1.5 group-hover/stack:translate-y-1.5 group-hover/stack:rotate-[1deg]',
              'dark:border-line/60 dark:bg-panel'
            )}
            aria-hidden="true"
          />
        </>
      )}

      {/* Main Foreground Card (Clean layout without front icon, without right chevron) */}
      <Link
        href={`/workdesk/tasks/${encodeURIComponent(card.id)}`}
        onClick={(e) => {
          if (onSelect) {
            e.preventDefault()
            onSelect(card.id, e.currentTarget)
          }
        }}
        className={cn(
          'group relative z-10 flex h-[62px] min-h-[62px] cursor-pointer flex-col justify-center rounded-xl border border-line bg-panel p-2.5 shadow-xs transition-all duration-150',
          'hover:border-[#b5ddd4] hover:bg-[#f8fcfa] hover:shadow-sm dark:hover:border-emerald-700/50 dark:hover:bg-emerald-950/20',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40',
          className
        )}
        role="button"
        aria-label={`${title} - ${card.scope}`}
      >
        {/* Top row: Title + Quick Quote to Agent */}
        <div className="flex w-full items-start justify-between gap-2">
          <span className="line-clamp-1 text-xs font-semibold leading-tight text-ink transition-colors group-hover:text-ink-vivid">{title}</span>
          <Tooltip content={t('git.operations.quoteToAgent') || 'Quote to Git Agent'} placement="top">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const prompt = `请协助分析并处理工作台任务【${title}】（涉及 ${card.scope}）。`
                quoteWorkdeskTaskToAgent({
                  title,
                  taskId: card.id,
                  scope: card.scope,
                  prompt,
                })
              }}
              className="flex size-5 shrink-0 items-center justify-center rounded-md text-ink-muted opacity-0 group-hover:opacity-100 hover:bg-accent/15 hover:text-accent transition-all duration-150 cursor-pointer"
              aria-label={t('git.operations.quoteToAgent') || 'Quote to Git Agent'}
              data-testid="workdesk-card-agent-btn"
            >
              <LuBot className="size-3" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        {/* Bottom row: Meta stats with icon + number (>99 formatted as 99+) with Tooltips */}
        <div className="mt-1 flex items-center gap-3 text-[11px] font-medium leading-tight text-ink-muted">
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
      </Link>
    </div>
  )
}
