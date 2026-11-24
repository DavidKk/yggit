'use client'

import React from 'react'
import { LuCloud, LuGitBranch } from 'react-icons/lu'

import { AnimatedCounter } from '@/components/git/AnimatedCounter'
import { handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

export interface SidebarRowProps {
  label: string
  branchName?: string
  title?: string
  current?: boolean
  isSolo?: boolean
  active: boolean
  depth?: number
  parentId?: string
  notice?: boolean
  ahead?: number
  behind?: number
  upstream?: string
  kind?: 'local' | 'remote'
  onSetUpstream?: () => void
  onClick: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

export function SidebarRow({
  label,
  branchName,
  title,
  current,
  isSolo,
  active,
  depth = 0,
  parentId,
  notice,
  ahead,
  behind,
  upstream,
  kind,
  onSetUpstream,
  onClick,
  onDoubleClick,
  onContextMenu,
  onPointerEnter,
  onPointerLeave,
}: SidebarRowProps) {
  const t = useT()

  return (
    <div
      role="treeitem"
      tabIndex={0}
      data-git-sidebar-branch={branchName || (kind === 'local' ? label : undefined)}
      title={title && title !== label ? title : undefined}
      aria-selected={active}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group/row flex h-8 w-full cursor-pointer select-text items-center justify-start px-2 font-normal text-xs transition-colors rounded-none outline-none focus-visible:ring-1 focus-visible:ring-accent',
        current && active
          ? 'bg-[color-mix(in_oklab,var(--accent)_22%,var(--ok)_12%)] text-accent font-semibold ring-1 ring-inset ring-accent/30 hover:bg-[color-mix(in_oklab,var(--accent)_28%,var(--ok)_16%)]'
          : current
            ? 'bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] text-ink font-medium hover:bg-[color-mix(in_oklab,var(--ok)_22%,transparent)]'
            : active
              ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent font-medium hover:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
              : 'text-ink hover:bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]'
      )}
      style={depth > 0 ? { paddingLeft: 8 + depth * 14 } : undefined}
      onClick={() => {
        const sel = typeof window !== 'undefined' ? window.getSelection() : null
        if (sel && sel.toString().trim().length > 0) return
        onClick()
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
          return
        }
        handleTreeParentKey(event, parentId)
      }}
    >
      <span data-git-sidebar-label className="min-w-0 flex-1 truncate whitespace-nowrap text-left select-text flex items-center">
        {(kind === 'local' || kind === 'remote') && <LuGitBranch className="size-3.5 shrink-0 text-ink-soft select-none mr-1.5" aria-hidden />}
        <span className="truncate">{label}</span>
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
        {kind === 'local' && (
          <>
            {ahead !== undefined && ahead > 0 && (
              <span
                className="font-mono text-[11px] text-ink-soft select-none flex items-center gap-0.5"
                title={t('git.operations.aheadCommits', { count: ahead }) || `Ahead by ${ahead} commit${ahead > 1 ? 's' : ''}`}
              >
                <AnimatedCounter value={ahead} max={99} suffix=" ↑" />
              </span>
            )}
            {behind !== undefined && behind > 0 && (
              <span
                className="font-mono text-[11px] text-ink-soft select-none flex items-center gap-0.5"
                title={t('git.operations.behindCommits', { count: behind }) || `Behind by ${behind} commit${behind > 1 ? 's' : ''}`}
              >
                <AnimatedCounter value={behind} max={99} suffix=" ↓" />
              </span>
            )}
            {!upstream && onSetUpstream && (
              <button
                type="button"
                title={t('git.operations.setUpstream') || 'Set upstream branch'}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onSetUpstream()
                }}
                className="opacity-0 group-hover/row:opacity-100 hover:text-accent rounded px-1 text-[11px] text-ink-soft select-none transition-opacity flex items-center gap-0.5 cursor-pointer"
              >
                <LuCloud className="size-3 shrink-0" />
              </button>
            )}
          </>
        )}
        {isSolo ? <span className="rounded bg-accent/20 px-1 py-0.2 text-[10px] font-semibold text-accent select-none">{t('git.operations.soloBadge') || 'Solo'}</span> : null}
        {notice ? <span className="size-1.5 shrink-0 rounded-full bg-accent select-none" aria-label={t('git.sidebar.remoteNewAria')} /> : null}
      </div>
    </div>
  )
}
