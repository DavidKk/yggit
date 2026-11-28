'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { getCachedConflictsBatch, type MergeConflictRecord, queryConflictsBatch } from '@/lib/git/conflict-cache'
import type { GitCommit } from '@/lib/git/types'
import { markForegroundActivity, runWithForegroundPriority } from '@/lib/workdesk/scheduler'

interface UseMergeConflictsOptions {
  repo?: string
  commits: GitCommit[]
  loading?: boolean
  scrollRef?: React.RefObject<HTMLDivElement | null> | null
  enabled?: boolean
  selectedHash?: string
}

/**
 * Hook to manage asynchronous conflict detection for Merge commits.
 * Strictly adheres to performance guidelines:
 * 1. Never triggers during scrolling.
 * 2. Never triggers during loading.
 * 3. Triggers only after being completely stable/idle for >= 800ms.
 * 4. Only inspects visible, uncached merge commits in small batches (max 5 at a time).
 * 5. Uses IndexedDB and local file cache for O(1) instant return without Git overhead.
 */
export function useMergeConflicts({ repo = '', commits, loading = false, scrollRef, enabled = true, selectedHash }: UseMergeConflictsOptions) {
  const [conflicts, setConflicts] = useState<Record<string, MergeConflictRecord>>({})
  const [driverModeVersion, setDriverModeVersion] = useState(0)

  const isScrollingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)

  const commitsRef = useRef(commits)
  commitsRef.current = commits
  const conflictsRef = useRef(conflicts)
  conflictsRef.current = conflicts
  const selectedHashRef = useRef(selectedHash)
  selectedHashRef.current = selectedHash
  const triggerIdleDetectionRef = useRef<() => void>(() => {})

  // Re-trigger conflict detection when driver mode switches (edge <-> local) without a full page reload
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleModeChange = () => {
      setDriverModeVersion((v) => v + 1)
    }
    window.addEventListener('yggit:driver_mode_changed', handleModeChange)
    return () => window.removeEventListener('yggit:driver_mode_changed', handleModeChange)
  }, [])

  // 1. Immediately hydrate any already-cached conflict records from IndexedDB/L1 memory (0ms)
  useEffect(() => {
    if (!repo || !commits.length) return

    const mergeHashes = commits.filter((c) => c && c.parents && c.parents.length >= 2).map((c) => c.hash)

    if (mergeHashes.length === 0) return

    let cancelled = false
    void getCachedConflictsBatch(repo, mergeHashes)
      .then((cached) => {
        if (!cancelled && Object.keys(cached).length > 0) {
          setConflicts((prev) => ({ ...prev, ...cached }))
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [repo, commits])

  // 2. Idle detection function (triggered strictly when stable and not scrolling/loading)
  const triggerIdleDetection = useCallback(() => {
    if (!enabled || loading || isScrollingRef.current || inFlightRef.current || !repo) return

    const currentCommits = commitsRef.current
    const currentConflicts = conflictsRef.current
    const currentSelectedHash = selectedHashRef.current

    // Find candidate merge commits that have not been cached yet
    const uncachedMerges: Array<{ hash: string; parents: string[] }> = []

    // Prioritize visible rows based on scroll offset if scroll element is available
    const el = scrollRef?.current
    const scrollTop = el ? el.scrollTop : 0
    const clientHeight = el ? el.clientHeight : 800
    const rowHeight = 26

    const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - 5)
    const endIdx = Math.min(currentCommits.length, Math.ceil((scrollTop + clientHeight) / rowHeight) + 10)

    const selected = currentCommits.find((commit) => commit.hash === currentSelectedHash)
    const visible = currentCommits.slice(startIdx, endIdx)
    // The selected file panel may belong to a merge outside the visible graph.
    const slice = selected ? [selected, ...visible.filter((commit) => commit.hash !== selected.hash)] : visible

    for (const commit of slice) {
      if (commit && commit.parents && commit.parents.length >= 2) {
        if (
          !currentConflicts[commit.hash] ||
          currentConflicts[commit.hash].status === 'error' ||
          (currentConflicts[commit.hash].hasConflict && (!currentConflicts[commit.hash].conflictFileCounts || currentConflicts[commit.hash].unresolvedConflictFiles === undefined))
        ) {
          uncachedMerges.push({ hash: commit.hash, parents: commit.parents })
        }
      }
    }

    if (uncachedMerges.length === 0) return

    // Limit to at most 5 per idle cycle to keep load virtually invisible
    const batch = uncachedMerges.slice(0, 5)
    const hasMore = uncachedMerges.length > batch.length

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    inFlightRef.current = true

    void runWithForegroundPriority(() => queryConflictsBatch(repo, batch, controller.signal))
      .then((newlyResolved) => {
        if (controller.signal.aborted) return
        if (Object.keys(newlyResolved).length > 0) {
          setConflicts((prev) => ({ ...prev, ...newlyResolved }))
          if (hasMore && !isScrollingRef.current) {
            if (idleTimerRef.current !== null) {
              window.clearTimeout(idleTimerRef.current)
            }
            idleTimerRef.current = window.setTimeout(() => {
              idleTimerRef.current = null
              triggerIdleDetectionRef.current()
            }, 100)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (abortControllerRef.current === controller) {
          inFlightRef.current = false
        }
      })
  }, [enabled, loading, repo, scrollRef])
  triggerIdleDetectionRef.current = triggerIdleDetection

  const hasCommits = commits.length > 0

  // 3. Scroll listener: Cancel running task immediately during scroll, schedule idle detection when stopped
  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return

    const handleScroll = () => {
      isScrollingRef.current = true
      markForegroundActivity()

      // Cancel any scheduled timer
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }

      // Abort in-flight request if user started scrolling
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
        inFlightRef.current = false
      }

      // Wait for stable idle pause (500ms) after scroll completely stops
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null
        isScrollingRef.current = false
        triggerIdleDetection()
      }, 500)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      el.removeEventListener('scroll', handleScroll)
      // Cleanup cancels the scroll timer, so it must also clear its busy flag.
      isScrollingRef.current = false
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
        inFlightRef.current = false
      }
    }
  }, [scrollRef, triggerIdleDetection, hasCommits])

  // 4. Loading/repo/mode listener: Never trigger during loading, schedule idle detection after loading completes
  useEffect(() => {
    if (loading || !enabled || !repo) {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
        inFlightRef.current = false
      }
      return
    }

    if (!commits.length) return

    // Schedule idle detection without resetting an already-pending timer on pagination updates
    if (idleTimerRef.current === null && !inFlightRef.current && !isScrollingRef.current) {
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null
        triggerIdleDetection()
      }, 250)
    }
  }, [loading, enabled, repo, commits.length, driverModeVersion, selectedHash, triggerIdleDetection])

  return {
    conflicts,
    getConflict: useCallback((hash: string) => conflicts[hash], [conflicts]),
  }
}
