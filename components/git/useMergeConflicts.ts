'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { getCachedConflictsBatch, type MergeConflictRecord, queryConflictsBatch } from '@/lib/git/conflict-cache'
import type { GitCommit } from '@/lib/git/types'

interface UseMergeConflictsOptions {
  repo?: string
  commits: GitCommit[]
  loading?: boolean
  scrollRef?: React.RefObject<HTMLDivElement | null> | null
  enabled?: boolean
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
export function useMergeConflicts({ repo = '', commits, loading = false, scrollRef, enabled = true }: UseMergeConflictsOptions) {
  const [conflicts, setConflicts] = useState<Record<string, MergeConflictRecord>>({})

  const isScrollingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)

  // 1. Immediately hydrate any already-cached conflict records from IndexedDB/L1 memory (0ms)
  useEffect(() => {
    if (!repo || !commits.length) return

    const mergeHashes = commits.filter((c) => c && c.parents && c.parents.length >= 2).map((c) => c.hash)

    if (mergeHashes.length === 0) return

    let cancelled = false
    void getCachedConflictsBatch(repo, mergeHashes).then((cached) => {
      if (!cancelled && Object.keys(cached).length > 0) {
        setConflicts((prev) => ({ ...prev, ...cached }))
      }
    })

    return () => {
      cancelled = true
    }
  }, [repo, commits])

  // 2. Idle detection function (triggered strictly when stable and not scrolling/loading)
  const triggerIdleDetection = useCallback(() => {
    if (!enabled || loading || isScrollingRef.current || inFlightRef.current || !repo) return

    // Find candidate merge commits that have not been cached yet
    const uncachedMerges: Array<{ hash: string; parents: string[] }> = []

    // Prioritize visible rows based on scroll offset if scroll element is available
    const el = scrollRef?.current
    const scrollTop = el ? el.scrollTop : 0
    const clientHeight = el ? el.clientHeight : 800
    const rowHeight = 26

    const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - 5)
    const endIdx = Math.min(commits.length, Math.ceil((scrollTop + clientHeight) / rowHeight) + 10)

    const slice = commits.slice(startIdx, endIdx)

    for (const commit of slice) {
      if (commit && commit.parents && commit.parents.length >= 2) {
        if (!conflicts[commit.hash]) {
          uncachedMerges.push({ hash: commit.hash, parents: commit.parents })
        }
      }
    }

    if (uncachedMerges.length === 0) return

    // Limit to at most 5 per idle cycle to keep load virtually invisible
    const batch = uncachedMerges.slice(0, 5)

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    inFlightRef.current = true

    void queryConflictsBatch(repo, batch, controller.signal)
      .then((newlyResolved) => {
        if (!controller.signal.aborted && Object.keys(newlyResolved).length > 0) {
          setConflicts((prev) => ({ ...prev, ...newlyResolved }))
        }
      })
      .finally(() => {
        inFlightRef.current = false
      })
  }, [enabled, loading, repo, commits, conflicts, scrollRef])

  // 3. Scroll listener: Cancel running task immediately during scroll, schedule idle detection when stopped
  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return

    const handleScroll = () => {
      isScrollingRef.current = true

      // Cancel any scheduled timer
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }

      // Abort in-flight request if user started scrolling
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // Wait for stable idle pause (800ms) after scroll completely stops
      idleTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false
        triggerIdleDetection()
      }, 800)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [scrollRef, triggerIdleDetection])

  // 4. Loading state listener: Never trigger during loading, schedule idle detection after loading completes
  useEffect(() => {
    if (loading) {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      return
    }

    // After loading completes, wait 800ms of stable idle before initiating any background check
    idleTimerRef.current = window.setTimeout(() => {
      triggerIdleDetection()
    }, 800)

    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
      }
    }
  }, [loading, triggerIdleDetection])

  return {
    conflicts,
    getConflict: useCallback((hash: string) => conflicts[hash], [conflicts]),
  }
}
