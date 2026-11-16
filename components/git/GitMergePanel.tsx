'use client'

import React, { useMemo } from 'react'
import { LuEye, LuGitMerge, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button } from '@/components/sk'
import { analyzeMergeTopology } from '@/lib/git/topology'
import type { GitCommit } from '@/lib/git/types'
import { cn } from '@/lib/utils'

type Props = {
  commit: GitCommit
  commits: GitCommit[]
  highlighted: boolean
  onHighlight: (active: boolean, hashes?: string[]) => void
  onLocate: (hash: string) => void
  onClose?: () => void
}

/** Standalone Merge Lineage Panel docked beside the Git history / graph */
export function GitMergePanel({ commit, commits, highlighted, onHighlight, onLocate, onClose }: Props) {
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

      <div className="flex items-center gap-1.5 shrink-0">
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
    </section>
  )
}
