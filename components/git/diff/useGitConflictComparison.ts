'use client'

import { useEffect, useMemo, useState } from 'react'

import { fetchRemergeDiff, type MergeConflictRecord } from '@/lib/git/conflict-cache'
import { conflictRegions, fileRemergePatch } from '@/lib/git/conflict-regions'
import { getGitDriver } from '@/lib/git/driver'
import { analyzeMergeTopology } from '@/lib/git/topology'
import type { GitCommit } from '@/lib/git/types'

import { rowsFor } from './DiffViewHelpers'

export function useGitConflictComparison({
  repo,
  hash,
  path,
  commit,
  commits,
  hasConflict,
  isConflictActive,
  onToggleConflict,
}: {
  repo: string
  hash: string
  path: string
  commit?: GitCommit
  commits: GitCommit[]
  hasConflict?: boolean
  isConflictActive?: boolean
  onToggleConflict?: (active: boolean) => void
}) {
  const [conflictActiveInternal, setConflictActiveInternal] = useState(false)
  const conflictActive = isConflictActive !== undefined ? isConflictActive : conflictActiveInternal
  const setConflictActive = (active: boolean) => {
    if (onToggleConflict) onToggleConflict(active)
    else setConflictActiveInternal(active)
  }

  const p1Hash = commit?.parents?.[0] || ''
  const p2Hash = commit?.parents?.[1] || ''
  const isMergeCommit = Boolean(commit && commit.parents.length > 1)
  const [conflictViewMode, setConflictViewMode] = useState<'3way' | 'remerge'>('3way')
  const [conflictContents, setConflictContents] = useState<[string | null, string | null, string | null]>([null, null, null])
  const [remergeDiff, setRemergeDiff] = useState('')
  const [remergeFiles, setRemergeFiles] = useState<string[]>([])
  const [remergeRecord, setRemergeRecord] = useState<MergeConflictRecord | null>(null)
  const [conflictLoading, setConflictLoading] = useState(false)
  const [remergeLoading, setRemergeLoading] = useState(false)
  const [conflictNavigation, setConflictNavigation] = useState({ index: -1, sequence: 0 })

  const topology = useMemo(() => {
    if (!commit || !commits || commits.length === 0) return null
    return analyzeMergeTopology(commit, new Map(commits.map((item) => [item.hash, item])))
  }, [commit, commits])

  const conflictPatch = useMemo(() => fileRemergePatch(remergeDiff, path), [remergeDiff, path])
  const regions = useMemo(() => conflictRegions(conflictPatch, [conflictContents[0] ?? '', conflictContents[1] ?? '']), [conflictPatch, conflictContents])
  const conflictRows = useMemo(() => conflictContents.map(rowsFor), [conflictContents])
  const patchRows = useMemo(() => rowsFor(conflictPatch || null), [conflictPatch])
  const activeRegion = regions[conflictNavigation.index]

  const p1Commit = useMemo(() => commits.find((c) => c.hash === p1Hash), [commits, p1Hash])
  const p2Commit = useMemo(() => commits.find((c) => c.hash === p2Hash), [commits, p2Hash])

  useEffect(() => {
    if ((!conflictActive && !hasConflict && !isMergeCommit) || !p1Hash || !p2Hash || !path) return
    let cancelled = false
    setConflictLoading(true)
    setRemergeLoading(true)
    const blob = async (h: string) => {
      if (!h || !path) return null
      try {
        const res = await getGitDriver().readBlob({ repo, hash: h, path })
        return res.binary ? null : res.content
      } catch {
        return null
      }
    }
    void Promise.all([blob(p1Hash), blob(p2Hash), blob(hash)])
      .then(([first, second, merged]) => {
        if (cancelled) return
        setConflictContents([first, second, merged])
        setConflictLoading(false)
      })
      .catch(() => {
        if (!cancelled) setConflictLoading(false)
      })
    void fetchRemergeDiff(repo, hash)
      .catch(() => ({ diff: '', files: [], record: null }))
      .then((diff) => {
        if (cancelled) return
        setRemergeDiff(diff.diff)
        setRemergeFiles(diff.files || [])
        setRemergeRecord(diff.record || null)
        setRemergeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repo, hash, p1Hash, p2Hash, path, hasConflict, conflictActive, isMergeCommit])

  useEffect(() => {
    if (regions.length > 0 && conflictNavigation.index === -1) {
      setConflictNavigation({ index: 0, sequence: 1 })
    }
  }, [regions, conflictNavigation.index])

  const stepConflict = (delta: number) =>
    setConflictNavigation((previous) => ({
      index: previous.index < 0 ? (delta > 0 ? 0 : regions.length - 1) : (previous.index + delta + regions.length) % regions.length,
      sequence: previous.sequence + 1,
    }))

  return {
    conflictActive,
    setConflictActive,
    p1Hash,
    p2Hash,
    p1Commit,
    p2Commit,
    topology,
    conflictViewMode,
    setConflictViewMode,
    conflictRows,
    patchRows,
    regions,
    activeRegion,
    conflictLoading,
    remergeLoading,
    conflictNavigation,
    remergeFiles,
    remergeRecord,
    stepConflict,
  }
}
