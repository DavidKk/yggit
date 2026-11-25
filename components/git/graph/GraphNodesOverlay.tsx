'use client'

import type { Dispatch, MutableRefObject, Ref, SetStateAction } from 'react'
import { LuInbox } from 'react-icons/lu'

import { GraphHoverCard, type GraphHoverNode } from '@/components/git/graph/GraphHoverCard'
import { type GraphContextMenu, GraphDefs, GraphStrokes, initials, isCommitCurrentBranch, MERGE_NODE_DOT, NODE_DOT } from '@/components/git/graph/GraphPrimitives'
import { refChips } from '@/components/git/RefChipsCell'
import type { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { type graphScene, laneColor, ROW, xAt } from '@/lib/git/graph-scene'
import { GIT_WORKTREE_HASH, type GitCommit, type GitStash } from '@/lib/git/types'
import { cn } from '@/lib/utils'

export type GraphOverlayHoverNode = GraphHoverNode & {
  color: string
  isMerge: boolean
}

interface GraphNodesOverlayProps {
  graphScrollRef: Ref<HTMLDivElement>
  syncGraphEdge: () => void
  contentWidth: number
  scene: ReturnType<typeof graphScene>
  commits: GitCommit[]
  lineageHashes?: Set<string> | null
  spotlightHashes?: Set<string> | null
  spotlightMap?: Map<string, unknown>
  isSpotlightActive: boolean
  isHoverBranchActive: boolean
  isBranchActive: boolean
  branchHashes: Set<string> | null
  remoteNames: string[]
  hiddenRemotes?: string[]
  soloRemote?: string | null
  branchAt: Map<string, string>
  contextMenu: GraphContextMenu | null
  hoveredHash: string | null
  checkedOut: Set<string>
  headIndex: number
  currentBranch?: string
  selectedHash?: string
  visibleStashes: GitStash[]
  conflicts?: Record<string, MergeConflictRecord>
  isScrollingRef: MutableRefObject<boolean>
  hoveredNode: GraphOverlayHoverNode | null
  setHoveredHash: Dispatch<SetStateAction<string | null>>
  setHoveredNode: Dispatch<SetStateAction<GraphOverlayHoverNode | null>>
  setContextMenu: Dispatch<SetStateAction<GraphContextMenu | null>>
  onSelect?: (commit: GitCommit) => void
  locale: ReturnType<typeof useLocaleCode>
  t: ReturnType<typeof useT>
}

export function GraphNodesOverlay({
  graphScrollRef,
  syncGraphEdge,
  contentWidth,
  scene,
  commits,
  lineageHashes,
  spotlightHashes,
  spotlightMap,
  isSpotlightActive,
  isHoverBranchActive,
  isBranchActive,
  branchHashes,
  remoteNames,
  hiddenRemotes,
  soloRemote,
  branchAt,
  contextMenu,
  hoveredHash,
  checkedOut,
  headIndex,
  currentBranch,
  selectedHash,
  visibleStashes,
  conflicts,
  isScrollingRef,
  hoveredNode,
  setHoveredHash,
  setHoveredNode,
  setContextMenu,
  onSelect,
  locale,
  t,
}: GraphNodesOverlayProps) {
  const { points } = scene

  return (
    <div
      ref={graphScrollRef}
      data-git-graph-pan
      className="pointer-events-none absolute top-0 left-[var(--git-branch-w)] z-[2] w-[var(--git-graph-w)] overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: scene.height }}
      onScroll={syncGraphEdge}
    >
      <div className="relative" style={{ width: contentWidth, height: scene.height }}>
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={contentWidth} height={scene.height} aria-hidden>
          <GraphDefs strokes={scene.strokes} />
          <GraphStrokes strokes={scene.strokes} lineageHashes={lineageHashes} spotlightHashes={spotlightHashes} />
          {commits.map((commit, index) => {
            const chips = refChips(commit.refs, remoteNames, { hiddenRemotes, soloRemote })
            const branch = branchAt.get(commit.hash) || ''
            const point = points[index]
            if (!point) return null
            const isContextActive = contextMenu?.type === 'commit' && contextMenu.commit.hash === commit.hash
            const isHovered = isContextActive || hoveredHash === commit.hash
            if (chips.length === 0 && (!branch || !isHovered)) return null
            const y = scene.commitRow[index] * ROW + ROW / 2
            const isMerge = commit.parents.length > 1
            const isCommitCurrent = isCommitCurrentBranch(commit, chips, checkedOut, headIndex, index, currentBranch)
            const color = laneColor(point.color)
            const nodeRadius = (isMerge ? MERGE_NODE_DOT : NODE_DOT) / 2
            const nodeX = xAt(point.lane)
            const x1 = 0
            const x2 = nodeX - nodeRadius
            if (x2 <= x1) return null
            return (
              <line
                key={`badge:${commit.hash}`}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={color}
                strokeWidth={isCommitCurrent ? 2 : 1}
                strokeDasharray={isCommitCurrent ? undefined : '3 3'}
                strokeOpacity={isCommitCurrent ? 1 : 0.7}
                strokeLinecap="round"
              />
            )
          })}
          {scene.dots
            .filter((dot) => dot.key === 'wip')
            .map((dot) => {
              const isSelected = selectedHash === GIT_WORKTREE_HASH
              return (
                <circle
                  key={dot.key}
                  cx={dot.x}
                  cy={dot.y}
                  r={isSelected ? dot.radius + 1 : dot.radius}
                  fill="var(--panel)"
                  stroke={dot.color}
                  strokeWidth={isSelected ? 2.5 : 2}
                  style={isSelected ? { filter: `drop-shadow(0 0 4px ${dot.color})` } : undefined}
                />
              )
            })}
        </svg>
        {scene.stashMarks.map((mark) => {
          const stash = visibleStashes.find((item) => item.hash === mark.hash)
          if (!stash) return null
          const tint = mark.color || 'var(--accent)'
          const isSelected = selectedHash === stash.hash
          const markX = mark.x
          return (
            <span
              key={mark.key}
              data-git-graph-dot
              data-git-node-hash={stash.hash}
              className={cn(
                'pointer-events-none select-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed transition-all duration-200',
                isSelected && 'scale-110 z-10'
              )}
              style={{
                left: markX,
                top: mark.y,
                width: NODE_DOT,
                height: NODE_DOT,
                borderColor: tint,
                color: tint,
                background: 'var(--panel)',
                boxShadow: isSelected ? `0 0 0 2px var(--panel), 0 0 0 4px ${tint}, 0 0 8px ${tint}` : `0 0 3px color-mix(in oklab, ${tint} 25%, transparent)`,
              }}
              aria-label={stash.name}
            >
              <LuInbox className="size-2.5" aria-hidden />
            </span>
          )
        })}
        {commits.map((commit, index) => {
          const point = points[index]
          if (!point) return null
          const y = scene.commitRow[index] * ROW + ROW / 2
          const tint = laneColor(point.color)
          const isMerge = commit.parents.length > 1
          const isConflictedMerge = isMerge && Boolean(conflicts?.[commit.hash]?.hasConflict)
          const isLineageHit = lineageHashes?.has(commit.hash)
          const isSpotlightHit = Boolean(spotlightMap?.get(commit.hash.toLowerCase()))
          const isSpotlightDimmed = isSpotlightActive && !isSpotlightHit
          const isHead = index === headIndex || commit.refs.some((r) => r === 'HEAD' || r.startsWith('HEAD -> '))
          const isTagged = commit.refs.some((r) => r.startsWith('tag: '))
          const isHoverBranchDimmed = isHoverBranchActive && isBranchActive && !branchHashes?.has(commit.hash)
          const isRemoteSoloDimmed = Boolean(soloRemote && !commit.refs.some((r) => r.startsWith(`${soloRemote}/`) || r === 'HEAD' || r.startsWith('HEAD -> ')))
          const isRemoteHiddenDimmed = Boolean(
            hiddenRemotes && hiddenRemotes.length > 0 && commit.refs.length > 0 && commit.refs.every((r) => hiddenRemotes.some((hr) => r.startsWith(`${hr}/`)))
          )
          const isDimmed = Boolean(
            (lineageHashes && lineageHashes.size > 0 && !isLineageHit && !isHead) || isSpotlightDimmed || isHoverBranchDimmed || isRemoteSoloDimmed || isRemoteHiddenDimmed
          )
          const isSelected = selectedHash === commit.hash
          const chips = refChips(commit.refs, remoteNames, { hiddenRemotes, soloRemote })
          const branch = branchAt.get(commit.hash) || ''
          const nodeX = xAt(point.lane)
          return (
            <span
              key={commit.hash}
              data-git-graph-dot
              data-git-node-hash={commit.hash}
              className={cn(
                'pointer-events-auto cursor-pointer select-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full leading-none transition-all duration-200',
                !isMerge && 'text-[9px] font-semibold text-ink',
                isSelected && 'scale-110 z-10',
                isLineageHit && 'ring-2 ring-accent ring-offset-1 ring-offset-[var(--panel)] scale-110 z-10 shadow-[0_0_8px_var(--accent)]',
                isSpotlightHit && 'ring-2 ring-accent ring-offset-1 ring-offset-[var(--panel)] scale-125 z-20 shadow-[0_0_12px_var(--accent)]',
                isDimmed ? 'opacity-25' : ''
              )}
              style={
                isMerge
                  ? {
                      left: nodeX,
                      top: y,
                      width: MERGE_NODE_DOT,
                      height: MERGE_NODE_DOT,
                      background: 'var(--panel)',
                      border: `1.5px solid ${tint}`,
                      boxShadow: isSelected ? `0 0 0 2px var(--panel), 0 0 0 4px ${tint}, 0 0 10px ${tint}` : `0 0 3px color-mix(in oklab, ${tint} 30%, transparent)`,
                    }
                  : {
                      left: nodeX,
                      top: y,
                      width: NODE_DOT,
                      height: NODE_DOT,
                      background: 'var(--panel)',
                      boxShadow: isSelected
                        ? `inset 0 0 0 1.5px ${tint}, 0 0 0 2px var(--panel), 0 0 0 4px ${tint}, 0 0 8px ${tint}`
                        : isHead
                          ? `inset 0 0 0 1.5px ${tint}, 0 0 0 1px var(--panel), 0 0 4px color-mix(in oklab, ${tint} 60%, white)`
                          : `inset 0 0 0 1.5px ${tint}`,
                      animation: isHead && !isSelected ? 'wt-head-breathe 2.8s ease-in-out infinite' : undefined,
                      ['--node-tint' as string]: tint,
                    }
              }
              title={`${commit.short || commit.hash.slice(0, 7)} · ${commit.author} (${commit.date})\n${commit.subject}${
                isConflictedMerge
                  ? '\n' +
                    t(conflicts?.[commit.hash]?.unresolvedConflictFiles?.length ? 'git.history.committedConflicts' : 'git.history.historicalConflicts', {
                      count: conflicts?.[commit.hash]?.unresolvedConflictFiles?.length || conflicts?.[commit.hash]?.conflictCount || 1,
                    })
                  : ''
              }`}
              aria-label={commit.author}
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(commit)
              }}
              onPointerEnter={() => {
                if (isScrollingRef.current) return
                setHoveredHash(commit.hash)
                setHoveredNode({
                  commit,
                  x: nodeX,
                  y,
                  color: tint,
                  isMerge,
                  isConflictedMerge,
                })
              }}
              onPointerLeave={() => {
                if (isScrollingRef.current) return
                setHoveredNode((prev) => (prev?.commit.hash === commit.hash ? null : prev))
                setHoveredHash((prev) => (prev === commit.hash ? null : prev))
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const branchList = [...chips.map((c) => c.label), ...(branch ? [branch] : [])]
                setContextMenu({
                  type: 'commit',
                  target: 'graph',
                  commit,
                  branches: branchList,
                  color: tint,
                  anchor: { x: event.clientX, y: event.clientY },
                })
              }}
            >
              {isMerge ? (
                <span className="size-1 rounded-full shrink-0" style={{ background: 'var(--wt-git-merge, var(--wt-merge, #d946ef))' }} aria-hidden />
              ) : (
                <>
                  {initials(commit.author)}
                  {isTagged && (
                    <span
                      className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full border border-panel bg-[var(--focus-contrast,#3b82f6)] shadow-[0_0_3px_color-mix(in_oklab,var(--focus-contrast,#3b82f6)_60%,transparent)]"
                      title="Tag"
                      aria-hidden
                    />
                  )}
                </>
              )}
            </span>
          )
        })}
        {hoveredNode && <GraphHoverCard hoveredNode={hoveredNode} contentWidth={contentWidth} locale={locale} conflicts={conflicts} t={t} />}
      </div>
    </div>
  )
}
