'use client'

import Link from 'next/link'
import React from 'react'
import { LuBot, LuChevronRight, LuCircleCheck, LuFlag, LuFolderTree, LuGitBranch, LuGitFork, LuGitMerge, LuRefreshCw } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
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

export function resolveCardIcon(iconName: string, categoryId: string) {
  const iconClass = 'size-4 shrink-0'
  if (iconName === 'LuRefreshCw') return <LuRefreshCw className={cn(iconClass, 'text-[#079b85]')} />
  if (iconName === 'LuGitFork') return <LuGitFork className={cn(iconClass, 'text-[#079b85]')} />
  if (iconName === 'LuGitMerge') return <LuGitMerge className={cn(iconClass, 'text-[#5878aa]')} />
  if (iconName === 'LuFlag') return <LuFlag className={cn(iconClass, 'text-[#a6751c]')} />
  if (iconName === 'LuFolderTree') return <LuFolderTree className={cn(iconClass, 'text-[#a6751c]')} />
  if (iconName === 'LuCheckCircle' || iconName === 'LuCircleCheck') return <LuCircleCheck className={cn(iconClass, 'text-[#4a8e7e]')} />

  switch (categoryId) {
    case 'branch':
      return <LuGitBranch className={cn(iconClass, 'text-[#079b85]')} />
    case 'merge':
      return <LuGitMerge className={cn(iconClass, 'text-[#5878aa]')} />
    case 'standard':
      return <LuFlag className={cn(iconClass, 'text-[#a6751c]')} />
    case 'review':
      return <LuCircleCheck className={cn(iconClass, 'text-[#4a8e7e]')} />
    default:
      return <LuGitBranch className={cn(iconClass, 'text-accent')} />
  }
}

export function WorkdeskCard({ card, className, noWrapperMargin = false, onSelect }: WorkdeskCardProps) {
  const t = useT()

  const i18nKey = CARD_I18N_MAP[card.id]
  const rawTitle = i18nKey ? t(`workdesk.cards.${i18nKey}.title` as MessageKey) : undefined
  const title = rawTitle && !rawTitle.startsWith('workdesk.cards.') ? rawTitle : card.title

  const parsedCount = parseInt(card.scope.match(/(\d+)/)?.[1] || '1', 10)
  const projectCount = card.projectCount !== undefined ? card.projectCount : parsedCount
  const isMultiple = projectCount > 1

  return (
    <div
      className={cn('group/stack relative transition-all duration-200 select-none', !noWrapperMargin && (isMultiple ? 'mb-2 pb-0.5' : 'mb-1'))}
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

      {/* Main Foreground Card */}
      <Link
        href={`/workdesk/tasks/${encodeURIComponent(card.id)}`}
        onClick={(e) => {
          if (onSelect) {
            e.preventDefault()
            onSelect(card.id, e.currentTarget)
          }
        }}
        className={cn(
          'group relative z-10 flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-panel p-2.5 shadow-xs transition-all duration-150',
          'hover:border-[#b5ddd4] hover:bg-[#f8fcfa] hover:shadow-sm dark:hover:border-emerald-700/50 dark:hover:bg-emerald-950/20',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40',
          className
        )}
        role="button"
        aria-label={`${title} - ${card.scope}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* Capsule icon container */}
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eef5f2] transition-colors',
              'group-hover:bg-[#e2f1ec] dark:bg-emerald-950/40 dark:group-hover:bg-emerald-900/50'
            )}
            aria-hidden="true"
          >
            {resolveCardIcon(card.iconName, card.categoryId)}
          </div>

          {/* Title and Scope */}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="line-clamp-2 text-xs font-semibold leading-tight text-ink transition-colors group-hover:text-ink-vivid">{title}</span>
            <span className="mt-0.5 text-[11px] leading-none text-ink-muted">{card.scope}</span>
          </div>
        </div>

        {/* Right action area: Agent quick quote button & chevron */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const prompt = `请协助分析并处理工作台任务【${title}】（涉及 ${card.scope}）。`
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('yggit:agent_open', { detail: { prompt } }))
              }
            }}
            className="flex size-6 items-center justify-center rounded-md text-ink-muted opacity-0 group-hover:opacity-100 hover:bg-accent/15 hover:text-accent transition-all duration-150"
            title="快速引用到 Git Agent"
            aria-label="快速引用到 Git Agent"
          >
            <LuBot className="size-3.5" aria-hidden="true" />
          </button>
          <div className="flex shrink-0 items-center text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
            <LuChevronRight className="size-3.5" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </div>
  )
}
