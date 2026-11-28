'use client'

import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

import type { LocateStatusState } from '@/components/git/GitLocateBanner'
import { getGitDriver } from '@/lib/git/driver'
import { findCommitInSegments, type GitHistorySegment } from '@/lib/git/history-segments'
import { gitSelectionHash } from '@/lib/git/scope'
import { GIT_WORKTREE_HASH, type GitCommit, type GitLogView, type GitSelection } from '@/lib/git/types'

type UseGitLogNavigationOptions = {
  view: GitLogView | null
  scope: string
  commits: GitCommit[]
  segments: GitHistorySegment[]
  startIndex: number
  historyScrollRef?: RefObject<HTMLDivElement | null>
  setSelection: (next: GitSelection) => void
  onMergeSegment: (commits: GitCommit[], hasMore: boolean, startIndex: number) => void
  setSelectedHash: Dispatch<SetStateAction<string>>
  setSelectedFile: Dispatch<SetStateAction<string>>
  setSelectedStatus: Dispatch<SetStateAction<string>>
  setLineageHashes: Dispatch<SetStateAction<string[] | null>>
  setConflictViewActive: Dispatch<SetStateAction<boolean>>
  setFocusRequest: Dispatch<SetStateAction<{ hash: string } | null>>
}

function getSelectionLabel(next: GitSelection, fallbackHash: string): string {
  if ('name' in next && next.name) return next.name
  if (next.kind === 'worktree') return next.path
  return fallbackHash.slice(0, 7)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message))
}

/**
 * Manages sidebar branch-hover preview timers, non-blocking segmented branch location, and commit navigation.
 */
export function useGitLogNavigation({
  view,
  scope,
  commits,
  segments,
  startIndex,
  historyScrollRef,
  setSelection,
  onMergeSegment,
  setSelectedHash,
  setSelectedFile,
  setSelectedStatus,
  setLineageHashes,
  setConflictViewActive,
  setFocusRequest,
}: UseGitLogNavigationOptions) {
  const [activeHoverBranch, setActiveHoverBranch] = useState<string | null>(null)
  const [locateStatus, setLocateStatus] = useState<LocateStatusState | null>(null)
  const hoverBranchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locateAbortRef = useRef<AbortController | null>(null)
  const locateSeqRef = useRef(0)
  const userInteractedRef = useRef(false)
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments

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

  const cancelLocate = useCallback(() => {
    locateAbortRef.current?.abort()
    locateAbortRef.current = null
    locateSeqRef.current += 1
    setLocateStatus(null)
  }, [])

  const dismissLocate = useCallback(() => {
    setLocateStatus((prev) => (prev?.phase === 'loading' ? prev : null))
  }, [])

  const markHistoryInteraction = useCallback(() => {
    userInteractedRef.current = true
  }, [])

  useEffect(() => {
    return () => {
      if (hoverBranchTimerRef.current) clearTimeout(hoverBranchTimerRef.current)
      locateAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    // Cancel active background locate when switching repositories or clearing view.
    cancelLocate()
  }, [view?.repo, cancelLocate])

  useEffect(() => {
    if (locateStatus?.phase !== 'loading') return
    const root = historyScrollRef?.current
    if (!root) return

    const onInteract = () => {
      userInteractedRef.current = true
    }
    root.addEventListener('wheel', onInteract, { passive: true })
    root.addEventListener('touchstart', onInteract, { passive: true })
    root.addEventListener('pointerdown', onInteract, { passive: true })
    return () => {
      root.removeEventListener('wheel', onInteract)
      root.removeEventListener('touchstart', onInteract)
      root.removeEventListener('pointerdown', onInteract)
    }
  }, [locateStatus?.phase, historyScrollRef])

  const jumpToLocated = useCallback(
    (hash: string) => {
      setSelectedHash(hash)
      setSelectedFile('')
      setSelectedStatus('')
      setLineageHashes(null)
      setConflictViewActive(false)
      setFocusRequest({ hash })
      setLocateStatus(null)
    },
    [setConflictViewActive, setFocusRequest, setLineageHashes, setSelectedFile, setSelectedHash, setSelectedStatus]
  )

  const repo = view?.repo

  const jumpToTop = useCallback(() => {
    const topSeg = segmentsRef.current[0]
    if (topSeg && topSeg.startIndex === 0) {
      historyScrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!repo) return
    const controller = new AbortController()
    const driver = getGitDriver()
    void driver
      .readLog({ repo, ref: scope, skip: 0, take: 50, signal: controller.signal })
      .then((res) => {
        if (res.commits.length > 0) {
          onMergeSegment(res.commits, Boolean(res.hasMore), 0)
          requestAnimationFrame(() => {
            historyScrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
          })
        }
      })
      .catch(() => {})
  }, [historyScrollRef, onMergeSegment, repo, scope])

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
      cancelLocate()
      setSelectedHash(GIT_WORKTREE_HASH)
      setSelectedFile('')
      setSelectedStatus('')
      setLineageHashes(null)
      setConflictViewActive(false)
      if (startIndex > 0 && view?.repo) {
        jumpToTop()
      } else {
        historyScrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }

    if (!targetHash) return

    const existing = findCommitInSegments(segmentsRef.current, targetHash)
    if (existing) {
      cancelLocate()
      setSelectedHash(existing.commit.hash)
      setSelectedFile('')
      setSelectedStatus('')
      setLineageHashes(null)
      setConflictViewActive(false)
      setFocusRequest({ hash: existing.commit.hash })
      return
    }

    // Immediate non-blocking response: update right-hand panel selection right away,
    // keep the user's current history view intact, and resolve the target segment asynchronously.
    setSelectedHash(targetHash)
    setSelectedFile('')
    setSelectedStatus('')
    setLineageHashes(null)
    setConflictViewActive(false)

    if (!view?.repo) return

    locateAbortRef.current?.abort()
    const controller = new AbortController()
    locateAbortRef.current = controller
    const seq = ++locateSeqRef.current
    userInteractedRef.current = false
    const label = getSelectionLabel(next, targetHash)
    setLocateStatus({ id: seq, hash: targetHash, target: label, phase: 'loading' })

    void (async () => {
      try {
        const driver = getGitDriver()
        let res = await driver.readLog({
          repo: view.repo,
          ref: scope,
          locate: targetHash,
          take: 50,
          signal: controller.signal,
        })
        if (controller.signal.aborted || locateSeqRef.current !== seq) return

        const clean = targetHash.trim().toLowerCase()
        const foundInRes = res.commits.some((c) => c.hash.toLowerCase() === clean || (clean.length >= 7 && c.hash.toLowerCase().startsWith(clean)))

        if (!foundInRes && scope && scope !== '*') {
          res = await driver.readLog({
            repo: view.repo,
            locate: targetHash,
            take: 50,
            signal: controller.signal,
          })
          if (controller.signal.aborted || locateSeqRef.current !== seq) return
        }

        const matched = res.commits.find((c) => c.hash.toLowerCase() === clean || (clean.length >= 7 && c.hash.toLowerCase().startsWith(clean)))

        if (matched && res.commits.length > 0) {
          onMergeSegment(res.commits, Boolean(res.hasMore), res.startIndex ?? 0)
          if (userInteractedRef.current) {
            setLocateStatus({ id: seq, hash: matched.hash, target: label, phase: 'ready' })
          } else {
            setLocateStatus(null)
            setSelectedHash(matched.hash)
            setFocusRequest({ hash: matched.hash })
          }
        } else {
          setLocateStatus({ id: seq, hash: targetHash, target: label, phase: 'not_found' })
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted || locateSeqRef.current !== seq) return
        setLocateStatus({ id: seq, hash: targetHash, target: label, phase: 'not_found' })
      }
    })()
  }

  return {
    activeHoverBranch,
    handleBranchHoverStart,
    handleBranchHoverEnd,
    select,
    locateStatus,
    cancelLocate,
    dismissLocate,
    jumpToLocated,
    jumpToTop,
    markHistoryInteraction,
  }
}
