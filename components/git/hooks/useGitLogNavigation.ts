'use client'

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

import { getGitDriver } from '@/lib/git/driver'
import { gitSelectionHash } from '@/lib/git/scope'
import { GIT_WORKTREE_HASH, type GitCommit, type GitLogView, type GitSelection } from '@/lib/git/types'

type UseGitLogNavigationOptions = {
  view: GitLogView | null
  scope: string
  commits: GitCommit[]
  startIndex: number
  setSelection: (next: GitSelection) => void
  setCommits: Dispatch<SetStateAction<GitCommit[]>>
  setHasMore: Dispatch<SetStateAction<boolean>>
  setHasPrev: Dispatch<SetStateAction<boolean>>
  setStartIndex: Dispatch<SetStateAction<number>>
  setSelectedHash: Dispatch<SetStateAction<string>>
  setSelectedFile: Dispatch<SetStateAction<string>>
  setSelectedStatus: Dispatch<SetStateAction<string>>
  setLineageHashes: Dispatch<SetStateAction<string[] | null>>
  setConflictViewActive: Dispatch<SetStateAction<boolean>>
  setFocusRequest: Dispatch<SetStateAction<{ hash: string } | null>>
}

/**
 * Manages sidebar branch-hover preview timers and selection-based graph commit navigation.
 */
export function useGitLogNavigation({
  view,
  scope,
  commits,
  startIndex,
  setSelection,
  setCommits,
  setHasMore,
  setHasPrev,
  setStartIndex,
  setSelectedHash,
  setSelectedFile,
  setSelectedStatus,
  setLineageHashes,
  setConflictViewActive,
  setFocusRequest,
}: UseGitLogNavigationOptions) {
  const [activeHoverBranch, setActiveHoverBranch] = useState<string | null>(null)
  const hoverBranchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBranchHoverStart = useCallback((branchName: string) => {
    if (!branchName) return
    if (hoverBranchTimerRef.current) clearTimeout(hoverBranchTimerRef.current)
    hoverBranchTimerRef.current = setTimeout(() => {
      setActiveHoverBranch(branchName)
    }, 1000)
  }, [])

  const handleBranchHoverEnd = useCallback(() => {
    if (hoverBranchTimerRef.current) {
      clearTimeout(hoverBranchTimerRef.current)
      hoverBranchTimerRef.current = null
    }
    setActiveHoverBranch(null)
  }, [])

  useEffect(() => {
    return () => {
      if (hoverBranchTimerRef.current) clearTimeout(hoverBranchTimerRef.current)
    }
  }, [])

  function select(next: GitSelection) {
    setSelection(next)
    let targetHash = view ? gitSelectionHash(view, next) : ''
    if (next.kind === 'worktree') {
      const entry = view?.worktrees.find((item) => item.path === next.path)
      if (entry?.current || next.path === view?.repo) {
        targetHash = GIT_WORKTREE_HASH
      }
    }
    if (!targetHash && (next.kind === 'local' || next.kind === 'remote' || next.kind === 'tag' || next.kind === 'stash')) {
      const hit = commits.find((c) =>
        c.refs.some(
          (r) =>
            r === next.name ||
            r === `HEAD -> ${next.name}` ||
            r === `tag: ${next.name}` ||
            r === `refs/heads/${next.name}` ||
            r === `refs/remotes/${next.name}` ||
            r.endsWith(`/${next.name}`)
        )
      )
      if (hit) targetHash = hit.hash
    }

    if (targetHash === GIT_WORKTREE_HASH) {
      if (startIndex > 0 && view?.repo) {
        void (async () => {
          try {
            const driver = getGitDriver()
            const res = await driver.readLog({ repo: view.repo, ref: scope, skip: 0, take: 50 })
            setCommits(res.commits)
            setHasMore(Boolean(res.hasMore))
            setHasPrev(false)
            setStartIndex(0)
            setSelectedHash(GIT_WORKTREE_HASH)
            setSelectedFile('')
            setSelectedStatus('')
            setLineageHashes(null)
            setConflictViewActive(false)
          } catch {}
        })()
        return
      }
      setSelectedHash(GIT_WORKTREE_HASH)
      setSelectedFile('')
      setSelectedStatus('')
      setLineageHashes(null)
      setConflictViewActive(false)
      return
    }

    if (targetHash) {
      const inWindow = commits.some((c) => c.hash === targetHash || c.hash.startsWith(targetHash))
      if (!inWindow && view?.repo) {
        void (async () => {
          try {
            const driver = getGitDriver()
            const res = await driver.readLog({
              repo: view.repo,
              ref: scope,
              locate: targetHash,
              take: 50,
            })
            if (res.commits.length > 0) {
              setCommits(res.commits)
              setHasMore(Boolean(res.hasMore))
              setHasPrev(Boolean(res.hasPrev))
              setStartIndex(res.startIndex ?? 0)
              setSelectedHash(targetHash)
              setSelectedFile('')
              setSelectedStatus('')
              setLineageHashes(null)
              setConflictViewActive(false)
              setFocusRequest({ hash: targetHash })
            }
          } catch {
            // Silently fallback if locate commit encounters an error
          }
        })()
        return
      }

      setSelectedHash(targetHash)
      setSelectedFile('')
      setSelectedStatus('')
      setLineageHashes(null)
      setConflictViewActive(false)
      setFocusRequest({ hash: targetHash })
    }
  }

  return {
    activeHoverBranch,
    handleBranchHoverStart,
    handleBranchHoverEnd,
    select,
  }
}
