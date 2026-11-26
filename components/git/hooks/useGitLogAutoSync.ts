'use client'

import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

import { getDriverMode, getGitDriver } from '@/lib/git/driver'
import { areCommitListsEquivalent, hasGitLogViewMetadataChanged, reconcileCommitsPreservingRefs } from '@/lib/git/refresh-diff'
import { GIT_WORKTREE_HASH, type GitCommit, type GitLogView, type GitSelection } from '@/lib/git/types'

export function useGitLogAutoSync({
  busy,
  view,
  viewRef,
  scopeRef,
  startIndexRef,
  commitsRef,
  selectedHashRef,
  selectedFileRef,
  isMainOverview,
  setView,
  setCommits,
  setHasMore,
  setHasPrev,
  setStartIndex,
  setSelectedFile,
  setSelectedStatus,
  setConflictViewActive,
  setSelectedHash,
  setSelection,
}: {
  busy: boolean
  view: GitLogView | null
  viewRef: MutableRefObject<GitLogView | null>
  scopeRef: MutableRefObject<string>
  startIndexRef: MutableRefObject<number>
  commitsRef: MutableRefObject<GitCommit[]>
  selectedHashRef: MutableRefObject<string>
  selectedFileRef: MutableRefObject<string>
  isMainOverview: boolean
  setView: Dispatch<SetStateAction<GitLogView | null>>
  setCommits: Dispatch<SetStateAction<GitCommit[]>>
  setHasMore: Dispatch<SetStateAction<boolean>>
  setHasPrev: Dispatch<SetStateAction<boolean>>
  setStartIndex: Dispatch<SetStateAction<number>>
  setSelectedFile: Dispatch<SetStateAction<string>>
  setSelectedStatus: Dispatch<SetStateAction<string>>
  setConflictViewActive: Dispatch<SetStateAction<boolean>>
  setSelectedHash: Dispatch<SetStateAction<string>>
  setSelection: (next: GitSelection) => void
}) {
  const [driverMode, setDriverMode] = useState<'edge' | 'local'>(() => getDriverMode())
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onModeChanged = () => {
      setDriverMode(getDriverMode())
    }
    window.addEventListener('yggit:driver_mode_changed', onModeChanged)
    return () => window.removeEventListener('yggit:driver_mode_changed', onModeChanged)
  }, [])

  const silentRefreshingRef = useRef(false)
  const silentRefresh = useCallback(async () => {
    if (silentRefreshingRef.current || busy) return
    const currentRepo = viewRef.current?.repo
    if (!currentRepo) return

    silentRefreshingRef.current = true
    const activeScope = scopeRef.current
    try {
      const driver = getGitDriver()
      driver.clearCache?.(currentRepo)
      const next = await driver.readLog({
        repo: currentRepo,
        ref: activeScope && activeScope !== '*' ? activeScope : undefined,
      })
      if (viewRef.current?.repo !== currentRepo || scopeRef.current !== activeScope) return

      setView((prev) => {
        if (!prev) return next
        if (!hasGitLogViewMetadataChanged(prev, next)) return prev
        return {
          ...prev,
          head: next.head,
          branch: next.branch,
          branches: next.branches,
          remotes: next.remotes,
          tags: next.tags,
          stashes: next.stashes,
          worktrees: next.worktrees,
          submodules: next.submodules,
          marks: next.marks,
          worktree: next.worktree,
        }
      })

      if (startIndexRef.current === 0) {
        if (commitsRef.current.length <= next.commits.length) {
          if (!areCommitListsEquivalent(commitsRef.current, next.commits)) {
            setCommits((prev) => reconcileCommitsPreservingRefs(prev, next.commits))
            setHasMore(next.hasMore)
            setHasPrev(Boolean(next.hasPrev))
            setStartIndex(next.startIndex ?? 0)
          }
        } else {
          setCommits((prev) => {
            if (prev.length <= next.commits.length) {
              return areCommitListsEquivalent(prev, next.commits) ? prev : next.commits
            }
            if (areCommitListsEquivalent(prev.slice(0, next.commits.length), next.commits)) {
              return prev
            }
            const freshHashes = new Set(next.commits.map((c) => c.hash))
            const tailHash = next.commits[next.commits.length - 1]?.hash
            const overlapIdx = tailHash ? prev.findIndex((c) => c.hash === tailHash) : -1
            if (overlapIdx >= 0) {
              const olderTail = prev.slice(overlapIdx + 1).filter((c) => !freshHashes.has(c.hash))
              return [...next.commits, ...olderTail]
            }
            const prevHashes = new Set(prev.map((c) => c.hash))
            const brandNew = next.commits.filter((c) => !prevHashes.has(c.hash))
            return brandNew.length > 0 ? [...brandNew, ...prev] : prev
          })
        }
      }

      const worktreeClean = !next.worktree || next.worktree.files === 0
      const isWorktree = selectedHashRef.current === GIT_WORKTREE_HASH || (!selectedHashRef.current && Boolean(viewRef.current?.worktree))
      if (worktreeClean && isWorktree) {
        if (selectedFileRef.current) {
          setSelectedFile('')
          setSelectedStatus('')
          setConflictViewActive(false)
        }
        const currentBranchName = next.head || next.branch || 'main'
        const currentBranchObj = next.branches.find((b) => b.name === currentBranchName || b.current)
        const headHash = currentBranchObj?.tip || next.commits.find((c) => c.refs.some((r) => r.includes(currentBranchName)))?.hash || next.commits[0]?.hash || ''
        if (headHash) {
          setSelectedHash(headHash)
          setSelection({ kind: 'local', name: currentBranchName })
        }
      }
    } catch {
      // Keep background revalidation non-intrusive
    } finally {
      silentRefreshingRef.current = false
    }
  }, [
    busy,
    commitsRef,
    scopeRef,
    selectedFileRef,
    selectedHashRef,
    setCommits,
    setConflictViewActive,
    setHasMore,
    setHasPrev,
    setSelectedFile,
    setSelectedHash,
    setSelectedStatus,
    setSelection,
    setStartIndex,
    setView,
    startIndexRef,
    viewRef,
  ])

  const lastFetchTimeRef = useRef<number>(0)
  const isFetchingRef = useRef<boolean>(false)

  const autoFetch = useCallback(
    async (force = false) => {
      const currentRepo = viewRef.current?.repo
      if (!currentRepo || isFetchingRef.current || busy) return
      const now = Date.now()
      if (!force && now - lastFetchTimeRef.current < 45_000) return

      isFetchingRef.current = true
      lastFetchTimeRef.current = now
      try {
        const driver = getGitDriver()
        await driver.fetch(currentRepo, { all: true, prune: true }).catch(() => {})
        await silentRefresh()
      } catch {
        // Silently ignore background fetch errors
      } finally {
        isFetchingRef.current = false
      }
    },
    [busy, silentRefresh, viewRef]
  )

  const isMainOverviewRef = useRef(isMainOverview)
  isMainOverviewRef.current = isMainOverview

  useEffect(() => {
    const repoName = view?.repo
    if (!repoName) return

    const IDLE_DELAY_MS = 8000
    const EDGE_POLL_MS = 15_000
    const REMOTE_FETCH_MS = 300_000

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let isIdle = process.env.NODE_ENV === 'test'
    let pendingWatchRefresh = false
    let eventSource: EventSource | null = null

    const flushPendingIfReady = () => {
      if (pendingWatchRefresh && isIdle && isMainOverviewRef.current && document.visibilityState === 'visible') {
        pendingWatchRefresh = false
        void silentRefresh()
      }
    }

    const scheduleIdle = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        isIdle = true
        flushPendingIfReady()
      }, IDLE_DELAY_MS)
    }

    const handleUserActivity = () => {
      isIdle = false
      scheduleIdle()
    }

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const
    for (const evt of activityEvents) {
      window.addEventListener(evt, handleUserActivity, { capture: true, passive: true })
    }
    scheduleIdle()

    const initTimer = setTimeout(() => {
      if (isMainOverviewRef.current) {
        void autoFetch()
      }
    }, 2000)

    const handleTrigger = () => {
      if (document.visibilityState !== 'visible' || !isMainOverviewRef.current) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!isMainOverviewRef.current) return
        if (Date.now() - lastFetchTimeRef.current >= 45_000) {
          void autoFetch()
        } else {
          void silentRefresh()
        }
      }, 250)
    }

    window.addEventListener('focus', handleTrigger)
    document.addEventListener('visibilitychange', handleTrigger)

    const mode = getDriverMode()
    if (mode === 'local' && isMainOverview && typeof EventSource !== 'undefined') {
      eventSource = new EventSource(`/api/git/watch?repo=${encodeURIComponent(repoName)}`)
      eventSource.addEventListener('change', () => {
        if (document.visibilityState !== 'visible' || !isMainOverviewRef.current) return
        if (isIdle) {
          void silentRefresh()
        } else {
          pendingWatchRefresh = true
        }
      })
    }

    const edgePollInterval =
      mode === 'edge'
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible' && isIdle && isMainOverviewRef.current) {
              void silentRefresh()
            }
          }, EDGE_POLL_MS)
        : null

    const fetchInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && isIdle && isMainOverviewRef.current) {
        void autoFetch()
      }
    }, REMOTE_FETCH_MS)

    return () => {
      clearTimeout(initTimer)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (idleTimer) clearTimeout(idleTimer)
      if (edgePollInterval !== null) window.clearInterval(edgePollInterval)
      window.clearInterval(fetchInterval)
      if (eventSource) {
        eventSource.close()
      }
      for (const evt of activityEvents) {
        window.removeEventListener(evt, handleUserActivity, true)
      }
      window.removeEventListener('focus', handleTrigger)
      document.removeEventListener('visibilitychange', handleTrigger)
    }
  }, [silentRefresh, autoFetch, view?.repo, isMainOverview, driverMode])

  return { silentRefresh, autoFetch }
}
