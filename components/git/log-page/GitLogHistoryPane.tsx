'use client'

import type { Dispatch, RefObject, SetStateAction } from 'react'

import { GitHistory } from '@/components/git/GitHistory'
import type { LocateStatusState } from '@/components/git/GitLocateBanner'
import { GitMergePanel } from '@/components/git/GitMergePanel'
import { EmptyState } from '@/components/sk'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import type { GitHistorySegment } from '@/lib/git/history-segments'
import { GIT_WORKTREE_HASH, type GitCommit, type GitLogView } from '@/lib/git/types'

interface GitLogHistoryPaneProps {
  sectionLabel: string
  emptyTitle: string
  emptyMessage: string
  emptyHint: string
  scopeMiss: boolean
  error: string
  view: GitLogView
  scope: string
  commits: GitCommit[]
  segments: GitHistorySegment[]
  hasMore: boolean
  hasPrev: boolean
  startIndex: number
  highlight: string
  lineageHashes: string[] | null
  lineageSet: Set<string> | null
  selectedHash: string
  selected: GitCommit | null
  conflicts: Record<string, MergeConflictRecord>
  historyScrollRef: RefObject<HTMLDivElement | null>
  focusRequest: { hash: string } | null
  locateStatus: LocateStatusState | null
  activeHoverBranch: string | null
  soloBranch: string | null
  soloRemote: string | null
  hiddenRemotes: string[]
  onJumpToLocated: (hash: string) => void
  onCancelLocate: () => void
  onDismissLocate: () => void
  onJumpTop: () => void
  onHistoryInteraction: () => void
  onBranchHoverStart: (branchName: string) => void
  onBranchHoverEnd: () => void
  onOpenConflictView: (hash?: string, file?: string) => void
  onSoloBranch: Dispatch<SetStateAction<string | null>>
  onCheckoutBranch: (branch: string, isRemote?: boolean) => Promise<void> | void
  onCreateBranch: (branch: string, startPoint?: string) => Promise<void> | void
  onDeleteBranch: (branch: string) => Promise<void> | void
  onRenameBranch: (oldName: string) => Promise<void> | void
  onPushBranch: (branch: string) => Promise<void> | void
  onPullBranch: (branch: string) => Promise<void> | void
  onPage: (scope: string, next: GitCommit[], more: boolean, nextHasPrev?: boolean, nextStartIndex?: number) => void
  onPagePrepend: (newCommits: GitCommit[], nextHasPrev: boolean, nextStartIndex: number) => void
  onAppendSegment: (segmentId: string, newCommits: GitCommit[], nextHasMore: boolean) => void
  onPrependSegment: (segmentId: string, newCommits: GitCommit[], newStartIndex: number) => void
  onMergeSegment: (commits: GitCommit[], more: boolean, startIndex: number) => void
  onRefresh: () => Promise<void> | void
  onSetLineageHashes: Dispatch<SetStateAction<string[] | null>>
  onLocateCommit: (hash: string) => void
  onSetSelectedHash: Dispatch<SetStateAction<string>>
  onSetSelectedFile: Dispatch<SetStateAction<string>>
  onSetSelectedStatus: Dispatch<SetStateAction<string>>
  onSetConflictViewActive: Dispatch<SetStateAction<boolean>>
}

/**
 * Center history workspace pane combining the segmented commit graph, locate pill, and merge lineage panel.
 */
export function GitLogHistoryPane({
  sectionLabel,
  emptyTitle,
  emptyMessage,
  emptyHint,
  scopeMiss,
  error,
  view,
  scope,
  commits,
  segments,
  hasMore,
  hasPrev,
  startIndex,
  highlight,
  lineageHashes,
  lineageSet,
  selectedHash,
  selected,
  conflicts,
  historyScrollRef,
  focusRequest,
  locateStatus,
  activeHoverBranch,
  soloBranch,
  soloRemote,
  hiddenRemotes,
  onJumpToLocated,
  onCancelLocate,
  onDismissLocate,
  onJumpTop,
  onHistoryInteraction,
  onBranchHoverStart,
  onBranchHoverEnd,
  onOpenConflictView,
  onSoloBranch,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  onPushBranch,
  onPullBranch,
  onPage,
  onPagePrepend,
  onAppendSegment,
  onPrependSegment,
  onMergeSegment,
  onRefresh,
  onSetLineageHashes,
  onLocateCommit,
  onSetSelectedHash,
  onSetSelectedFile,
  onSetSelectedStatus,
  onSetConflictViewActive,
}: GitLogHistoryPaneProps) {
  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-line" aria-label={sectionLabel}>
      {error ? <p className="m-0 px-3 py-2 text-xs text-fail">{error}</p> : null}
      {scopeMiss ? (
        <EmptyState title={emptyTitle} message={emptyMessage} hint={emptyHint} density="panel" />
      ) : (
        <GitHistory
          repo={view.repo}
          remoteUrl={view.remoteUrl}
          scope={scope}
          commits={commits}
          segments={segments}
          hasMore={hasMore}
          hasPrev={hasPrev}
          startIndex={startIndex}
          worktree={view.worktree}
          stashes={view.stashes}
          highlight={highlight}
          lineageHashes={lineageSet}
          remoteNames={[...new Set(view.remotes.map((item) => item.remote))]}
          worktreeBranches={view.worktrees.filter((item) => item.branch && !item.current).map((item) => item.branch)}
          selectedHash={selectedHash}
          conflicts={conflicts}
          scrollRef={historyScrollRef}
          focusRequest={focusRequest}
          locateStatus={locateStatus}
          onJumpToLocated={onJumpToLocated}
          onCancelLocate={onCancelLocate}
          onDismissLocate={onDismissLocate}
          onJumpTop={onJumpTop}
          onHistoryInteraction={onHistoryInteraction}
          activeHoverBranch={activeHoverBranch}
          onBranchHoverStart={onBranchHoverStart}
          onBranchHoverEnd={onBranchHoverEnd}
          onSelect={(commit) => {
            onSetSelectedHash(commit.hash)
            onSetSelectedFile('')
            onSetSelectedStatus('')
            onSetLineageHashes(null)
            onSetConflictViewActive(false)
          }}
          onSelectWorktree={() => {
            onSetSelectedHash(GIT_WORKTREE_HASH)
            onSetSelectedFile('')
            onSetSelectedStatus('')
            onSetLineageHashes(null)
            onSetConflictViewActive(false)
          }}
          onOpenConflictView={onOpenConflictView}
          currentBranch={view.branch}
          soloBranch={soloBranch}
          onSoloBranch={onSoloBranch}
          soloRemote={soloRemote}
          hiddenRemotes={hiddenRemotes}
          onCheckoutBranch={onCheckoutBranch}
          onCreateBranch={onCreateBranch}
          onDeleteBranch={onDeleteBranch}
          onRenameBranch={onRenameBranch}
          onPushBranch={onPushBranch}
          onPullBranch={onPullBranch}
          onPage={onPage}
          onPagePrepend={onPagePrepend}
          onAppendSegment={onAppendSegment}
          onPrependSegment={onPrependSegment}
          onMergeSegment={onMergeSegment}
          onRefresh={onRefresh}
        />
      )}
      {selected && selected.parents && selected.parents.length >= 2 ? (
        <GitMergePanel
          repo={view.repo}
          commit={selected}
          commits={commits}
          conflict={conflicts[selected.hash]}
          highlighted={Boolean(lineageHashes && lineageHashes.length > 0)}
          onHighlight={(active, hashes) => {
            if (!active || !hashes) {
              onSetLineageHashes(null)
            } else {
              onSetLineageHashes(hashes)
            }
          }}
          onLocate={onLocateCommit}
          onOpenConflictView={() => onOpenConflictView(selected.hash)}
        />
      ) : null}
    </section>
  )
}
