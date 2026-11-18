'use client'

import { LuTriangleAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk/Tooltip'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import type { GitCommit } from '@/lib/git/types'
import { cn } from '@/lib/utils'

interface Props {
  commit: GitCommit
  conflict?: MergeConflictRecord
  onOpenConflictView?: (hash: string, file?: string) => void
}

export function CommitStatusBadge({ commit, conflict, onOpenConflictView }: Props) {
  const t = useT()
  const unresolved = Boolean(conflict?.unresolvedConflictFiles?.length)
  const count = unresolved ? conflict!.unresolvedConflictFiles!.length : conflict?.conflictCount || conflict?.conflictFiles?.length || 1
  const label = t(unresolved ? 'git.history.committedConflicts' : 'git.history.historicalConflicts', { count })

  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          onOpenConflictView?.(commit.hash, conflict?.unresolvedConflictFiles?.[0] || conflict?.conflictFiles?.[0])
        }}
        className={cn(
          'relative z-20 mr-1.5 flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[3.5px] border transition-colors',
          unresolved ? 'border-danger/50 bg-danger/15 text-danger hover:bg-danger/25' : 'border-warn/50 bg-warn/15 text-warn hover:bg-warn/25'
        )}
      >
        <LuTriangleAlert className="size-3 shrink-0" aria-hidden />
      </button>
    </Tooltip>
  )
}
