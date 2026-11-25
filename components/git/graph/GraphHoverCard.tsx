'use client'

import { LuTriangleAlert } from 'react-icons/lu'

import type { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { formatCommitAgo } from '@/lib/git/format-commit-ago'
import type { GitCommit } from '@/lib/git/types'

export interface GraphHoverNode {
  commit: GitCommit
  x: number
  y: number
  isConflictedMerge: boolean
}

export function GraphHoverCard({
  hoveredNode,
  contentWidth,
  locale,
  conflicts,
  t,
}: {
  hoveredNode: GraphHoverNode
  contentWidth: number
  locale: ReturnType<typeof useLocaleCode>
  conflicts?: Record<string, MergeConflictRecord>
  t: ReturnType<typeof useT>
}) {
  return (
    <div
      className="pointer-events-none absolute z-50 animate-in fade-in-50 zoom-in-95 duration-150"
      style={{
        left: Math.max(145, Math.min(hoveredNode.x, contentWidth - 145)),
        top: hoveredNode.y < 95 ? hoveredNode.y + 14 : hoveredNode.y - 10,
        transform: hoveredNode.y < 95 ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
    >
      <div className="flex flex-col gap-1 w-72 rounded-lg border border-line bg-panel/95 p-2.5 shadow-xl text-left select-none backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-accent">{hoveredNode.commit.short || hoveredNode.commit.hash.slice(0, 7)}</span>
          <span className="text-[11px] text-ink-soft">{formatCommitAgo(hoveredNode.commit.date, locale)}</span>
        </div>
        <p className="text-xs font-medium text-ink leading-snug line-clamp-2">{hoveredNode.commit.subject}</p>
        <div className="flex items-center justify-between gap-2 border-t border-line/50 pt-1.5 mt-0.5 text-[11px] text-ink-soft font-sans">
          <span className="font-medium text-ink truncate">{hoveredNode.commit.author}</span>
          <span className="text-[10px] text-ink-soft/80 shrink-0">{hoveredNode.commit.date}</span>
        </div>
        {hoveredNode.isConflictedMerge && (
          <div className="flex items-center gap-1.5 text-[11px] text-warn pt-0.5">
            <LuTriangleAlert className="size-3.5 shrink-0" />
            <span>
              {t(conflicts?.[hoveredNode.commit.hash]?.unresolvedConflictFiles?.length ? 'git.history.committedConflicts' : 'git.history.historicalConflicts', {
                count: conflicts?.[hoveredNode.commit.hash]?.unresolvedConflictFiles?.length || conflicts?.[hoveredNode.commit.hash]?.conflictCount || 1,
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
