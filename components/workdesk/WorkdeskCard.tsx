'use client'

import Link from 'next/link'
import React from 'react'
import { LuChevronRight, LuCircleCheck, LuFlag, LuFolderTree, LuGitBranch, LuGitFork, LuGitMerge, LuRefreshCw } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { WorkCard } from '@/lib/workdesk/types'

interface WorkdeskCardProps {
  card: WorkCard
  className?: string
  onSelect?: (cardId: string) => void
}

const CARD_I18N_MAP: Record<string, string> = {
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

export function WorkdeskCard({ card, className, onSelect }: WorkdeskCardProps) {
  const t = useT()

  const i18nKey = CARD_I18N_MAP[card.id]
  const rawTitle = i18nKey ? t(`workdesk.cards.${i18nKey}.title` as MessageKey) : undefined
  const title = rawTitle && !rawTitle.startsWith('workdesk.cards.') ? rawTitle : card.title

  return (
    <Link
      href={`/workdesk/tasks/${encodeURIComponent(card.id)}`}
      onClick={(e) => {
        if (onSelect) {
          e.preventDefault()
          onSelect(card.id)
        }
      }}
      className={cn(
        'group relative flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-panel p-2.5 shadow-xs transition-all duration-150',
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

      {/* Right chevron indicator */}
      <div className="flex shrink-0 items-center text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
        <LuChevronRight className="size-3.5" aria-hidden="true" />
      </div>
    </Link>
  )
}
