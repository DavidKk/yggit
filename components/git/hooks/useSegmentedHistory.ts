'use client'

import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from 'react'

import {
  appendCommitsToSegment,
  createHistorySegment,
  flattenSegmentsCommits,
  type GitHistorySegment,
  mergeHistorySegment,
  prependCommitsToSegment,
} from '@/lib/git/history-segments'
import type { GitCommit, GitLogView } from '@/lib/git/types'

/**
 * Maintains segmented commit history state (`A -> Gap B -> C`) while exposing backwards-compatible
 * flat `commits` / `hasMore` / `hasPrev` / `startIndex` setters for repository refresh & optimistic hooks.
 */
export function useSegmentedHistory(initialView: GitLogView | null) {
  const [segments, setSegments] = useState<GitHistorySegment[]>(() =>
    initialView ? [createHistorySegment(initialView.commits, initialView.hasMore, initialView.startIndex ?? 0)] : []
  )

  const commits = useMemo(() => flattenSegmentsCommits(segments), [segments])
  const topSegment = segments[0]
  const bottomSegment = segments[segments.length - 1]
  const startIndex = topSegment?.startIndex ?? 0
  const hasPrev = Boolean(topSegment && topSegment.startIndex > 0)
  const hasMore = Boolean(bottomSegment?.hasMore)

  const setCommits: Dispatch<SetStateAction<GitCommit[]>> = useCallback((action) => {
    setSegments((prev) => {
      const flat = flattenSegmentsCommits(prev)
      const nextCommits = typeof action === 'function' ? action(flat) : action
      const first = prev[0]
      const last = prev[prev.length - 1]
      return [createHistorySegment(nextCommits, last?.hasMore ?? false, first?.startIndex ?? 0, first?.id)]
    })
  }, [])

  const setHasMore: Dispatch<SetStateAction<boolean>> = useCallback((action) => {
    setSegments((prev) => {
      if (prev.length === 0) return prev
      const lastIndex = prev.length - 1
      const prevMore = prev[lastIndex].hasMore
      const nextMore = typeof action === 'function' ? action(prevMore) : action
      return prev.map((seg, idx) => (idx === lastIndex ? { ...seg, hasMore: nextMore } : seg))
    })
  }, [])

  const setHasPrev: Dispatch<SetStateAction<boolean>> = useCallback((action) => {
    setSegments((prev) => {
      if (prev.length === 0) return prev
      const currentHasPrev = prev[0].startIndex > 0
      const nextHasPrev = typeof action === 'function' ? action(currentHasPrev) : action
      if (!nextHasPrev && prev[0].startIndex > 0) {
        return prev.map((seg, idx) => (idx === 0 ? { ...seg, startIndex: 0 } : seg))
      }
      return prev
    })
  }, [])

  const setStartIndex: Dispatch<SetStateAction<number>> = useCallback((action) => {
    setSegments((prev) => {
      if (prev.length === 0) return prev
      const nextStart = typeof action === 'function' ? action(prev[0].startIndex) : action
      return prev.map((seg, idx) => (idx === 0 ? { ...seg, startIndex: Math.max(0, Math.floor(nextStart)) } : seg))
    })
  }, [])

  const resetHistory = useCallback((nextCommits: GitCommit[], nextHasMore: boolean, nextStartIndex = 0) => {
    setSegments([createHistorySegment(nextCommits, nextHasMore, nextStartIndex)])
  }, [])

  const mergeSegment = useCallback((incomingCommits: GitCommit[], incomingHasMore: boolean, incomingStartIndex = 0) => {
    setSegments((prev) => mergeHistorySegment(prev, createHistorySegment(incomingCommits, incomingHasMore, incomingStartIndex)))
  }, [])

  const appendSegment = useCallback((segmentId: string, newCommits: GitCommit[], nextHasMore: boolean) => {
    setSegments((prev) => appendCommitsToSegment(prev, segmentId, newCommits, nextHasMore))
  }, [])

  const prependSegment = useCallback((segmentId: string, newCommits: GitCommit[], newStartIndex: number) => {
    setSegments((prev) => prependCommitsToSegment(prev, segmentId, newCommits, newStartIndex))
  }, [])

  return {
    segments,
    commits,
    hasMore,
    hasPrev,
    startIndex,
    setCommits,
    setHasMore,
    setHasPrev,
    setStartIndex,
    resetHistory,
    mergeSegment,
    appendSegment,
    prependSegment,
  }
}
