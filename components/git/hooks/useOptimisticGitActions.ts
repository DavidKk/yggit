'use client'

import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from 'react'

import { applyIncrementalCommitSuccess, type OptimisticGraphState } from '@/lib/git/optimistic-updates'
import type { GitCommit, GitLogView } from '@/lib/git/types'

export type RunWithGraphRollback = (updater: (state: OptimisticGraphState) => OptimisticGraphState, execute: () => Promise<unknown>, errorFallback: string) => Promise<boolean>

type UseOptimisticGitActionsOptions = {
  viewRef: MutableRefObject<GitLogView | null>
  commitsRef: MutableRefObject<GitCommit[]>
  setView: Dispatch<SetStateAction<GitLogView | null>>
  setCommits: Dispatch<SetStateAction<GitCommit[]>>
  onError: (message: string) => void
}

/**
 * Coordinates optimistic Git graph/sidebar state updates across Local and Edge drivers
 * with deterministic rollback and error-only toast notifications.
 */
export function useOptimisticGitActions({ viewRef, commitsRef, setView, setCommits, onError }: UseOptimisticGitActionsOptions) {
  const runWithGraphRollback = useCallback<RunWithGraphRollback>(
    async (updater, execute, errorFallback) => {
      const prevView = viewRef.current
      const prevCommits = commitsRef.current
      if (!prevView) {
        try {
          await execute()
          return true
        } catch (err) {
          onError(err instanceof Error ? err.message : errorFallback)
          return false
        }
      }

      const targetRepo = prevView.repo
      const nextState = updater({ view: prevView, commits: prevCommits })
      viewRef.current = nextState.view
      commitsRef.current = nextState.commits
      setView(nextState.view)
      setCommits(nextState.commits)

      try {
        await execute()
        return true
      } catch (err) {
        if (viewRef.current?.repo === targetRepo) {
          viewRef.current = prevView
          commitsRef.current = prevCommits
          setView(prevView)
          setCommits(prevCommits)
        }
        onError(err instanceof Error ? err.message : errorFallback)
        return false
      }
    },
    [viewRef, commitsRef, setView, setCommits, onError]
  )

  const handleCommitSuccess = useCallback(
    (params: { hash?: string; subject: string; remainingFilesCount?: number }) => {
      const currentView = viewRef.current
      if (!currentView) return
      const next = applyIncrementalCommitSuccess({ view: currentView, commits: commitsRef.current }, params)
      viewRef.current = next.view
      commitsRef.current = next.commits
      setView(next.view)
      setCommits(next.commits)
    },
    [viewRef, commitsRef, setView, setCommits]
  )

  return {
    runWithGraphRollback,
    handleCommitSuccess,
  }
}
