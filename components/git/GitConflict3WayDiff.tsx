'use client'

import { GitFileDiff } from '@/components/git/GitFileDiff'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import type { GitCommit } from '@/lib/git/types'

interface Props {
  repo?: string
  commit: GitCommit
  commits: GitCommit[]
  conflict?: MergeConflictRecord
  selectedPath: string
  onSelectPath?: (path: string) => void
  onClose: () => void
  onSwitchToDiff?: () => void
}

export function GitConflict3WayDiff({ repo = '', commit, commits, conflict, selectedPath, onClose, onSwitchToDiff }: Props) {
  return (
    <GitFileDiff
      repo={repo}
      hash={commit.hash}
      path={selectedPath || conflict?.conflictFiles?.[0] || ''}
      commit={commit}
      commits={commits}
      conflict={conflict}
      isConflictActive={true}
      onToggleConflict={(active) => {
        if (!active && onSwitchToDiff) onSwitchToDiff()
      }}
      onClose={onClose}
    />
  )
}
