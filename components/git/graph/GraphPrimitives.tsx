'use client'

import { memo, type ReactNode, type Ref } from 'react'

import { type FloatingAnchor, type refChips } from '@/components/git/RefChipsCell'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { DOT, type graphScene, isHighlightedStroke, laneColor, type Stroke } from '@/lib/git/graph-scene'
import type { GitCommit, GitStash, GitWorktree } from '@/lib/git/types'

export type GitGraphProps = {
  repo?: string
  remoteUrl?: string
  commits: GitCommit[]
  worktree: GitWorktree | null
  stashes?: GitStash[]
  highlight: string
  lineageHashes?: Set<string> | null
  remoteNames?: string[]
  worktreeBranches?: string[]
  selectedHash?: string
  activeHoverBranch?: string | null
  onBranchHoverStart?: (branchName: string) => void
  onBranchHoverEnd?: () => void
  findNeedle?: string
  scrollRef?: Ref<HTMLDivElement>
  header?: ReactNode
  footer?: ReactNode
  conflicts?: Record<string, MergeConflictRecord>
  onSelect?: (commit: GitCommit) => void
  onSelectWorktree?: () => void
  onOpenConflictView?: (hash: string, file?: string) => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onPushBranch?: (branch: string) => Promise<void> | void
  onPullBranch?: (branch: string) => Promise<void> | void
  onCreateBranch?: (branch: string, startPoint?: string) => Promise<void> | void
  onDeleteBranch?: (branch: string) => Promise<void> | void
  onRenameBranch?: (oldName: string) => Promise<void> | void
  onRefresh?: () => Promise<void> | void
  currentBranch?: string
  soloBranch?: string | null
  onSoloBranch?: (branch: string | null) => void
  soloRemote?: string | null
  hiddenRemotes?: string[]
}

export const BADGE_H = DOT
export const NODE_DOT = 16
export const MERGE_NODE_DOT = 8

export function isCommitCurrentBranch(
  commit: GitCommit,
  chips: ReturnType<typeof refChips>,
  checkedOut: Set<string>,
  headIndex: number | null | undefined,
  index: number,
  currentBranch?: string
): boolean {
  if (index === headIndex) return true
  if (chips.some((chip) => chip.kind === 'head' || checkedOut.has(chip.name))) return true
  if (commit.refs.some((r) => r === 'HEAD' || r.startsWith('HEAD -> '))) return true
  if (currentBranch) {
    if (checkedOut.has(currentBranch) && chips.some((chip) => chip.name === currentBranch)) return true
    if (commit.refs.some((r) => r === currentBranch || r === `HEAD -> ${currentBranch}` || r.endsWith(`/${currentBranch}`))) return true
    if (chips.some((chip) => chip.name === currentBranch || chip.name === `origin/${currentBranch}` || chip.name.endsWith(`/${currentBranch}`))) return true
  }
  return false
}

export type GraphContextMenu =
  | {
      type: 'commit'
      target?: 'branch' | 'commit' | 'graph'
      commit: GitCommit
      branches: string[]
      color: string
      anchor: FloatingAnchor
    }
  | {
      type: 'stash'
      stash: GitStash
      color: string
      anchor: FloatingAnchor
    }
  | {
      type: 'worktree'
      worktree: GitWorktree
      color: string
      anchor: FloatingAnchor
    }

export const BRANCH_MIN = 130
export const MESSAGE_MIN = 140
export const BRANCH_DEFAULT = 160
export const GRAPH_MIN = 80
export const GRAPH_DEFAULT_WIDTH = 240

export function toDateKey(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function stashFindHit(stash: GitStash, needle: string) {
  if (!needle) return true
  const hay = `${stash.subject}\n${stash.name}\n${stash.hash}`.toLowerCase()
  return hay.includes(needle)
}

export function commitFindHit(commit: GitCommit, needle: string) {
  if (!needle) return true
  const hay = `${commit.subject}\n${commit.author}\n${commit.hash}\n${commit.refs.join('\n')}`.toLowerCase()
  return hay.includes(needle)
}

export function _refHit(ref: string, name: string): boolean {
  return ref === name || ref === `HEAD -> ${name}` || ref === `tag: ${name}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return [...parts[0]][0]?.toUpperCase() || '?'
  return `${[...parts[0]][0] || ''}${[...parts[1]][0] || ''}`.toUpperCase()
}

/** Memoized SVG linearGradient definitions layer to avoid DOM churn on hover / selection. */
export const GraphDefs = memo(function GraphDefs({
  strokes,
}: {
  strokes: Stroke[]
  commits?: GitCommit[]
  points?: ReturnType<typeof graphScene>['points']
  commitRow?: number[]
  remoteNames?: string[]
  checkedOut?: Set<string>
  headIndex?: number | null
}) {
  return (
    <defs>
      <style>{`
        @keyframes wt-head-breathe {
          0%, 100% {
            box-shadow: inset 0 0 0 1.5px var(--node-tint, var(--accent, #3b82f6)), 0 0 0 1px var(--panel), 0 0 3px color-mix(in oklab, var(--node-tint, var(--accent, #3b82f6)) 50%, transparent);
          }
          50% {
            box-shadow: inset 0 0 0 2px var(--node-tint, var(--accent, #3b82f6)), 0 0 0 1px var(--panel), 0 0 5px color-mix(in oklab, var(--node-tint, var(--accent, #3b82f6)) 80%, white);
          }
        }
      `}</style>
      {strokes
        .filter((s) => s.startColor !== undefined && s.targetColor !== undefined && s.startColor !== s.targetColor)
        .map((s) => {
          const gradId = 'wt-grad-' + s.key.replace(/[^a-zA-Z0-9_-]/g, '_')
          return (
            <linearGradient key={gradId} id={gradId} gradientUnits="userSpaceOnUse" x1={s.x1 ?? 0} y1={s.y1 ?? 0} x2={s.x2 ?? 0} y2={s.y2 ?? 0}>
              <stop offset="0%" stopColor={laneColor(s.startColor!)} />
              <stop offset="100%" stopColor={laneColor(s.targetColor!)} />
            </linearGradient>
          )
        })}
    </defs>
  )
})

/** Memoized SVG tree branch strokes layer to prevent re-renders on hover or loading state. */
export const GraphStrokes = memo(function GraphStrokes({
  strokes,
  lineageHashes,
  spotlightHashes,
  branchHashes,
}: {
  strokes: Stroke[]
  lineageHashes?: Set<string> | null
  spotlightHashes?: Set<string> | null
  branchHashes?: Set<string> | null
}) {
  const hasLineage = Boolean(lineageHashes && lineageHashes.size > 0)
  const hasSpotlight = Boolean(spotlightHashes && spotlightHashes.size > 0)
  const hasBranch = Boolean(branchHashes && branchHashes.size > 0)
  const anyHighlightActive = hasLineage || hasSpotlight || hasBranch

  return (
    <>
      {strokes.map((stroke) => {
        const isTrunk = stroke.fromLane === 0 && stroke.toLane === 0
        const hasGrad = stroke.startColor !== undefined && stroke.targetColor !== undefined && stroke.startColor !== stroke.targetColor
        const gradId = 'wt-grad-' + stroke.key.replace(/[^a-zA-Z0-9_-]/g, '_')
        const strokePaint = hasGrad ? `url(#${gradId})` : laneColor(stroke.color)

        const isLineage = isHighlightedStroke(stroke, lineageHashes)
        const isSpotlight = Boolean(
          hasSpotlight && stroke.childHash && stroke.parentHash && spotlightHashes?.has(stroke.childHash.toLowerCase()) && spotlightHashes?.has(stroke.parentHash.toLowerCase())
        )
        const isBranch = Boolean(hasBranch && stroke.childHash && stroke.parentHash && branchHashes?.has(stroke.childHash) && branchHashes?.has(stroke.parentHash))
        const isHighlighted = isLineage || isSpotlight || isBranch
        const strokeWidth = isHighlighted ? (stroke.dashed ? 2.6 : isTrunk ? 3.8 : 3.0) : stroke.dashed ? 1.4 : isTrunk ? 2.5 : 1.8
        const opacity = anyHighlightActive ? (isHighlighted ? 1 : 0.18) : 1

        return (
          <g
            key={stroke.key}
            data-git-edge-child={stroke.childHash}
            data-git-edge-parent={stroke.parentHash}
            data-git-edge-highlighted={isHighlighted || undefined}
            fill="none"
            opacity={opacity}
            className="transition-opacity duration-200"
          >
            {stroke.bridge && Math.abs((stroke.fromLane ?? 0) - (stroke.toLane ?? 0)) > 1 && (
              <path d={stroke.d} stroke="var(--panel)" strokeWidth={3} strokeLinecap="butt" strokeLinejoin="round" />
            )}
            <path
              d={stroke.d}
              stroke={isHighlighted ? (stroke.color !== undefined ? laneColor(stroke.color) : 'var(--accent)') : strokePaint}
              strokeWidth={strokeWidth}
              strokeDasharray={stroke.dashed ? '3 3' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )
      })}
    </>
  )
})
