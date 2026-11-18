'use client'

import React, { useMemo } from 'react'
import { LuEye, LuGitMerge, LuTriangleAlert, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Tooltip } from '@/components/sk'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { analyzeMergeTopology } from '@/lib/git/topology'
import type { GitCommit } from '@/lib/git/types'
import { cn } from '@/lib/utils'

type Props = {
  repo?: string
  commit: GitCommit
  commits: GitCommit[]
  conflict?: MergeConflictRecord
  highlighted: boolean
  onHighlight: (active: boolean, hashes?: string[]) => void
  onLocate: (hash: string) => void
  onOpenConflictView?: () => void
  onClose?: () => void
}

/** Standalone Merge Lineage Panel docked beside the Git history / graph */
export function GitMergePanel({ commit, commits, conflict, highlighted, onHighlight, onLocate, onOpenConflictView, onClose }: Props) {
  const t = useT()
  const topology = useMemo(() => {
    if (!commit.parents || commit.parents.length < 2) return null
    return analyzeMergeTopology(commit, new Map(commits.map((item) => [item.hash, item])))
  }, [commit, commits])

  if (!topology || !topology.isMerge) return null

  return (
    <section
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-line bg-panel/95 px-4 py-2 shadow-xs backdrop-blur-xs select-none transition-all duration-200"
      aria-label={t('git.commit.mergeLineage')}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Tooltip content={t('git.commit.mergeLineage')} placement="top">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent shrink-0 cursor-default">
            <LuGitMerge className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t('git.commit.mergeLineage')}</span>
          </div>
        </Tooltip>

        <div className="flex min-w-0 items-center gap-1.5 text-xs font-mono">
          <button
            type="button"
            className="min-w-0 truncate font-semibold text-accent hover:underline focus-visible:outline-accent cursor-pointer"
            title={topology.sourceBranchHint || topology.parent2Hash}
            onClick={() => topology.parent2Hash && onLocate(topology.parent2Hash)}
          >
            {topology.sourceBranchHint || topology.parent2Hash?.slice(0, 8)}
          </button>
          <span className="text-ink-soft select-none">➔</span>
          <button
            type="button"
            className="min-w-0 truncate font-semibold text-ink hover:underline focus-visible:outline-accent cursor-pointer"
            title={topology.targetBranchHint || topology.parent1Hash}
            onClick={() => topology.parent1Hash && onLocate(topology.parent1Hash)}
          >
            {topology.targetBranchHint || topology.parent1Hash?.slice(0, 8)}
          </button>
        </div>

        {topology.commitsIncluded.length > 0 ? (
          <Badge tone="neutral" size="mini" dot={false} className="shrink-0 text-[10px] font-sans">
            {topology.commitsIncluded.length} {t('git.commit.commitsCount')}
          </Badge>
        ) : null}
      </div>

      {/* Extensible Statuses & Actions: pure ICON + TOOLTIP buttons with unified background & borders */}
      <div className="flex items-center gap-1.5 shrink-0" role="toolbar" aria-label="合并状态与操作">
        {conflict?.hasConflict ? (
          <Tooltip content="曾发生冲突" placement="top">
            <button
              type="button"
              onClick={onOpenConflictView}
              className="flex size-7 items-center justify-center rounded-md border border-warn/40 bg-warn/15 text-warn hover:bg-warn/25 active:scale-95 transition-all cursor-pointer shadow-xs"
              aria-label="曾发生冲突"
            >
              <LuTriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          </Tooltip>
        ) : null}

        <Tooltip content={highlighted ? t('git.commit.clearHighlight') || '取消高亮' : '高亮分支'} placement="top">
          <Button
            variant="plain"
            size="icon"
            className={cn(
              'size-7 cursor-pointer transition-all border shadow-xs',
              highlighted ? 'bg-accent/25 text-accent font-semibold border-accent/60' : 'bg-accent/15 text-accent border-accent/40 hover:bg-accent/25 active:scale-95'
            )}
            aria-pressed={highlighted}
            aria-label={highlighted ? t('git.commit.clearHighlight') || '取消高亮' : '高亮分支'}
            onClick={() => onHighlight(!highlighted, topology.commitsIncluded)}
          >
            <LuEye className="size-3.5 text-accent shrink-0" aria-hidden />
          </Button>
        </Tooltip>

        {onClose ? (
          <Tooltip content={t('common.close') || '关闭'} placement="top">
            <Button
              variant="plain"
              size="icon"
              className="size-7 text-ink-soft hover:text-ink hover:bg-[var(--overlay-06)] cursor-pointer transition-all"
              aria-label={t('common.close') || '关闭'}
              onClick={onClose}
            >
              <LuX className="size-3.5" aria-hidden />
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </section>
  )
}
