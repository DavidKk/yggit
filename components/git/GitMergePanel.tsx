'use client'

import React, { useMemo, useState } from 'react'
import { LuEye, LuGitMerge, LuTriangleAlert, LuX } from 'react-icons/lu'

import { MergeConflictDetailModal } from '@/components/git/MergeConflictDetailModal'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button } from '@/components/sk'
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
  onClose?: () => void
}

/** Standalone Merge Lineage Panel docked beside the Git history / graph */
export function GitMergePanel({ repo = '', commit, commits, conflict, highlighted, onHighlight, onLocate, onClose }: Props) {
  const t = useT()
  const [showDetailModal, setShowDetailModal] = useState(false)
  const topology = useMemo(() => {
    if (!commit.parents || commit.parents.length < 2) return null
    return analyzeMergeTopology(commit, new Map(commits.map((item) => [item.hash, item])))
  }, [commit, commits])

  if (!topology || !topology.isMerge) return null

  return (
    <>
      <section
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-line bg-panel/95 px-4 py-2 shadow-xs backdrop-blur-xs select-none transition-all duration-200"
        aria-label={t('git.commit.mergeLineage')}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent shrink-0">
            <LuGitMerge className="size-4" aria-hidden />
            <span>{t('git.commit.mergeLineage')}</span>
          </div>

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

        <div className="flex items-center gap-2 shrink-0">
          {conflict?.hasConflict ? (
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className="flex items-center gap-1.5 rounded-md bg-warn/15 hover:bg-warn/25 px-2.5 py-1 text-xs font-medium text-warn transition-colors cursor-pointer"
              title="该合并曾解决冲突，点击查看具体冲突文件与解决方案"
            >
              <LuTriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              <span>曾发生冲突 ({conflict.conflictCount || conflict.conflictFiles?.length || 1})</span>
              <span className="text-[11px] underline opacity-80 hover:opacity-100 ml-0.5">查看解决方案</span>
            </button>
          ) : null}

          <Button
            variant="plain"
            size="xs"
            className={cn(
              'h-7 gap-1.5 whitespace-nowrap px-2.5 text-xs font-medium transition-colors cursor-pointer',
              highlighted ? 'bg-accent/20 text-accent font-semibold border border-accent/40 shadow-xs' : 'text-ink-soft hover:text-ink hover:bg-[var(--overlay-06)]'
            )}
            aria-pressed={highlighted}
            onClick={() => onHighlight(!highlighted, topology.commitsIncluded)}
          >
            <LuEye className={cn('size-3.5 transition-colors', highlighted ? 'text-accent' : 'text-ink-soft')} aria-hidden />
            <span>{t('git.commit.highlightLineage')}</span>
          </Button>

          {onClose ? (
            <Button
              variant="plain"
              size="icon"
              className="size-7 text-ink-soft hover:text-ink hover:bg-[var(--overlay-06)] cursor-pointer"
              aria-label={t('common.close') || '关闭'}
              onClick={onClose}
            >
              <LuX className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>

        {showDetailModal && <MergeConflictDetailModal repo={repo} commit={commit} conflict={conflict} onClose={() => setShowDetailModal(false)} />}
      </section>
    </>
  )
}
