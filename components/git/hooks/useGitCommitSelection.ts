'use client'

import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from 'react'

import { getGitDriver } from '@/lib/git/driver'
import type { GitCommit, GitFileChange, GitLogView, GitSelection } from '@/lib/git/types'

export function useGitCommitSelection({
  view,
  viewRef,
  scope,
  commits,
  selectedIsWorktree,
  selectedFile,
  setFilePanel,
  setSelectedFile,
  setSelectedStatus,
  setConflictViewActive,
  setLineageHashes,
  setSelectedHash,
  setFocusRequest,
  setCommits,
  setHasMore,
  setHasPrev,
  setStartIndex,
  onMergeSegment,
  setCommitFiles,
  setSelection,
  setView,
}: {
  view: GitLogView | null
  viewRef: MutableRefObject<GitLogView | null>
  scope: string
  commits: GitCommit[]
  selectedIsWorktree: boolean
  selectedFile: string
  setFilePanel: Dispatch<SetStateAction<{ type: 'history' | 'blame'; path: string; hash?: string } | null>>
  setSelectedFile: Dispatch<SetStateAction<string>>
  setSelectedStatus: Dispatch<SetStateAction<string>>
  setConflictViewActive: Dispatch<SetStateAction<boolean>>
  setLineageHashes: Dispatch<SetStateAction<string[] | null>>
  setSelectedHash: Dispatch<SetStateAction<string>>
  setFocusRequest: Dispatch<SetStateAction<{ hash: string } | null>>
  setCommits: Dispatch<SetStateAction<GitCommit[]>>
  setHasMore: Dispatch<SetStateAction<boolean>>
  setHasPrev: Dispatch<SetStateAction<boolean>>
  setStartIndex: Dispatch<SetStateAction<number>>
  onMergeSegment?: (commits: GitCommit[], hasMore: boolean, startIndex: number) => void
  setCommitFiles: Dispatch<SetStateAction<GitFileChange[]>>
  setSelection: (next: GitSelection) => void
  setView: Dispatch<SetStateAction<GitLogView | null>>
}) {
  const handleLocateCommit = useCallback(
    async (commitHash: string) => {
      if (!commitHash) return
      setFilePanel(null)
      setSelectedFile('')
      setSelectedStatus('')
      setConflictViewActive(false)
      setLineageHashes(null)
      setSelectedHash(commitHash)
      setFocusRequest({ hash: commitHash })

      if (!view?.repo) return
      const clean = commitHash.trim().toLowerCase()
      const inWindow = commits.some((c) => c.hash.toLowerCase() === clean || c.short.toLowerCase() === clean || c.hash.toLowerCase().startsWith(clean))

      if (!inWindow) {
        try {
          const driver = getGitDriver()
          let res = await driver
            .readLog({
              repo: view.repo,
              ref: scope,
              locate: commitHash,
              take: 50,
            })
            .catch(() => null)

          if (!res || !res.commits || res.commits.length === 0) {
            res = await driver
              .readLog({
                repo: view.repo,
                locate: commitHash,
                take: 50,
              })
              .catch(() => null)
          }

          if (res && res.commits && res.commits.length > 0) {
            if (onMergeSegment) {
              onMergeSegment(res.commits, Boolean(res.hasMore), res.startIndex ?? 0)
            } else {
              setCommits(res.commits)
              setHasMore(Boolean(res.hasMore))
              setHasPrev(Boolean(res.hasPrev))
              setStartIndex(res.startIndex ?? 0)
            }
            setSelectedHash(commitHash)
            setFocusRequest({ hash: commitHash })
          }
        } catch {}
      }
    },
    [
      commits,
      scope,
      setCommits,
      setConflictViewActive,
      setFilePanel,
      setFocusRequest,
      setHasMore,
      setHasPrev,
      setLineageHashes,
      onMergeSegment,
      setSelectedFile,
      setSelectedHash,
      setSelectedStatus,
      setStartIndex,
      view,
    ]
  )

  const handleCommitFilesLoaded = useCallback(
    (files: GitFileChange[]) => {
      setCommitFiles(files)
      if (selectedIsWorktree) {
        if (files.length === 0) {
          setSelectedFile('')
          setSelectedStatus('')
          setConflictViewActive(false)
          const currentBranchName = viewRef.current?.head || viewRef.current?.branch || 'main'
          const currentBranchObj = viewRef.current?.branches.find((b) => b.name === currentBranchName || b.current)
          const headHash = currentBranchObj?.tip || commits.find((c) => c.refs.some((r) => r.includes(currentBranchName)))?.hash || commits[0]?.hash || ''
          if (headHash) {
            setSelectedHash(headHash)
            setSelection({ kind: 'local', name: currentBranchName })
          }
        } else if (selectedFile && !files.some((f) => f.path === selectedFile)) {
          setSelectedFile('')
          setSelectedStatus('')
          setConflictViewActive(false)
        }
        setView((prev) => {
          if (!prev) return prev
          if (files.length === 0) {
            if (prev.worktree === null) return prev
            return { ...prev, worktree: null }
          }
          let added = 0
          let deleted = 0
          let modified = 0
          for (const f of files) {
            if (f.status === 'A' || f.status === '?' || f.status === 'U') added++
            else if (f.status === 'D') deleted++
            else modified++
          }
          return {
            ...prev,
            worktree: {
              files: files.length,
              insertions: prev.worktree?.insertions ?? 0,
              deletions: prev.worktree?.deletions ?? 0,
              addedFiles: added,
              deletedFiles: deleted,
              modifiedFiles: modified,
            },
          }
        })
      }
    },
    [commits, selectedFile, selectedIsWorktree, setCommitFiles, setConflictViewActive, setSelectedFile, setSelectedHash, setSelectedStatus, setSelection, setView, viewRef]
  )

  return { handleLocateCommit, handleCommitFilesLoaded }
}
