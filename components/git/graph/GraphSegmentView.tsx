'use client'

import { type Dispatch, memo, type MutableRefObject, type RefObject, type SetStateAction, useMemo } from 'react'

import { AnnotationBadge } from '@/components/git/agent/spotlight/AnnotationBadge'
import { CommitStatusBadge } from '@/components/git/CommitStatusBadge'
import { GraphNodesOverlay, type GraphOverlayHoverNode } from '@/components/git/graph/GraphNodesOverlay'
import { BADGE_H, commitFindHit, type GraphContextMenu, isCommitCurrentBranch, toDateKey } from '@/components/git/graph/GraphPrimitives'
import { DateBoundaryDividers, StashRow, WorktreeRow } from '@/components/git/graph/GraphSpecialRows'
import { branchAtCommits, refChips, RefChipsCell } from '@/components/git/RefChipsCell'
import type { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { DOT, graphScene, laneColor, xAt } from '@/lib/git/graph-scene'
import { type GitCommit, type GitStash, type GitWorktree } from '@/lib/git/types'
import { cn } from '@/lib/utils'
import type { SpotlightTarget } from '@/services/git/agent-impact'

export interface GraphSegmentViewProps {
  segmentId: string
  commits: GitCommit[]
  scene: ReturnType<typeof graphScene>
  worktree: GitWorktree | null
  visibleStashes: GitStash[]
  contentWidth: number
  columns: string
  selectedHash?: string
  findNeedle: string
  highlight: string
  lineageHashes?: Set<string> | null
  spotlightHashes: Set<string> | null
  spotlightMap?: Map<string, SpotlightTarget>
  isSpotlightActive: boolean
  isHoverBranchActive: boolean
  isBranchActive: boolean
  branchHashes: Set<string> | null
  remoteNames: string[]
  hiddenRemotes?: string[]
  soloRemote?: string | null
  soloBranch?: string | null
  checkedOut: Set<string>
  currentBranch?: string
  conflicts?: Record<string, MergeConflictRecord>
  contextMenu: GraphContextMenu | null
  hoveredHash: string | null
  hoveredNode: GraphOverlayHoverNode | null
  isScrollingRef: MutableRefObject<boolean>
  graphScrollRef: RefObject<HTMLDivElement | null>
  syncGraphEdge: () => void
  graphRightEdgeFade: boolean
  setContextMenu: Dispatch<SetStateAction<GraphContextMenu | null>>
  setHoveredHash: Dispatch<SetStateAction<string | null>>
  setHoveredNode: Dispatch<SetStateAction<GraphOverlayHoverNode | null>>
  onSelect?: (commit: GitCommit) => void
  onSelectWorktree?: () => void
  onOpenConflictView?: (hash: string, file?: string) => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onPushBranch?: (branch: string) => Promise<void> | void
  onPullBranch?: (branch: string) => Promise<void> | void
  onCreateBranch?: (branch: string, startPoint?: string) => Promise<void> | void
  onDeleteBranch?: (branch: string) => Promise<void> | void
  onRenameBranch?: (oldName: string) => Promise<void> | void
  onSoloBranch?: (branch: string | null) => void
  onBranchPointerEnter: (branchName: string) => void
  onBranchPointerLeave: () => void
  onClearBranchHover: () => void
  locale: ReturnType<typeof useLocaleCode>
  t: ReturnType<typeof useT>
}

export const GraphSegmentView = memo(function GraphSegmentView({
  segmentId,
  commits,
  scene,
  worktree,
  visibleStashes,
  contentWidth,
  columns,
  selectedHash,
  findNeedle,
  highlight,
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
  soloBranch,
  checkedOut,
  currentBranch,
  conflicts,
  contextMenu,
  hoveredHash,
  hoveredNode,
  isScrollingRef,
  graphScrollRef,
  syncGraphEdge,
  graphRightEdgeFade,
  setContextMenu,
  setHoveredHash,
  setHoveredNode,
  onSelect,
  onSelectWorktree,
  onOpenConflictView,
  onCheckoutBranch,
  onPushBranch,
  onPullBranch,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  onSoloBranch,
  onBranchPointerEnter,
  onBranchPointerLeave,
  onClearBranchHover,
  locale,
  t,
}: GraphSegmentViewProps) {
  const { points, headIndex } = scene
  const branchAt = useMemo(() => branchAtCommits(commits, points, remoteNames), [commits, points, remoteNames])

  const dateBoundaries = useMemo(() => {
    const boundaries: Array<{ rowIndex: number; date: string }> = []
    for (let rowIndex = 1; rowIndex < scene.rows.length; rowIndex++) {
      const row = scene.rows[rowIndex]
      const currDate = row.kind === 'commit' ? commits[row.index]?.date : row.kind === 'stash' ? row.stash.date : ''
      const prevRow = scene.rows[rowIndex - 1]
      const prevDate = prevRow?.kind === 'commit' ? commits[prevRow.index]?.date : prevRow?.kind === 'stash' ? prevRow.stash.date : ''
      if (currDate && prevDate && toDateKey(currDate) !== toDateKey(prevDate)) {
        boundaries.push({ rowIndex, date: currDate })
      }
    }
    return boundaries
  }, [scene.rows, commits])

  return (
    <div className="relative min-w-0" data-git-segment-id={segmentId}>
      <DateBoundaryDividers dateBoundaries={dateBoundaries} locale={locale} />
      <ol className="m-0 list-none">
        {scene.rows.map((row) => {
          if (row.kind === 'worktree' && worktree) {
            return (
              <WorktreeRow
                key="worktree"
                worktree={worktree}
                scene={scene}
                headIndex={headIndex}
                selectedHash={selectedHash}
                contextMenu={contextMenu}
                columns={columns}
                onSelectWorktree={onSelectWorktree}
                setContextMenu={setContextMenu}
                t={t}
              />
            )
          }
          if (row.kind === 'stash') {
            return (
              <StashRow
                key={row.stash.name}
                stash={row.stash}
                scene={scene}
                selectedHash={selectedHash}
                findNeedle={findNeedle}
                contextMenu={contextMenu}
                columns={columns}
                onSelect={onSelect}
                setContextMenu={setContextMenu}
              />
            )
          }
          if (row.kind !== 'commit') return null
          const index = row.index
          const commit = commits[index]
          if (!commit) return null
          const selected = selectedHash === commit.hash
          const findHit = commitFindHit(commit, findNeedle)
          const chips = refChips(commit.refs, remoteNames, { hiddenRemotes, soloRemote })
          const point = points[index]
          const color = point ? laneColor(point.color) : 'var(--accent)'
          const branch = branchAt.get(commit.hash) || ''
          const isLineageActive = Boolean(lineageHashes && lineageHashes.size > 0)
          const isLineageHit = isLineageActive && lineageHashes!.has(commit.hash)
          const isContextActive = contextMenu?.type === 'commit' && contextMenu.commit.hash === commit.hash
          const spotlightTarget = spotlightMap?.get(commit.hash.toLowerCase())
          const isSpotlightHit = Boolean(spotlightTarget)
          const isSpotlightDimmed = isSpotlightActive && !isSpotlightHit
          const isHead = index === headIndex || commit.refs.some((r) => r === 'HEAD' || r.startsWith('HEAD -> '))
          const isCommitCurrent = isCommitCurrentBranch(commit, chips, checkedOut, headIndex, index, currentBranch)
          const isCurrentBranchHead = Boolean(
            isCommitCurrent || (currentBranch && commit.refs.some((r) => r === currentBranch || r === `HEAD -> ${currentBranch}` || r.endsWith(`/${currentBranch}`)))
          )
          const marked = Boolean(highlight && commit.refs.some((r) => r === highlight || r === `HEAD -> ${highlight}` || r === `tag: ${highlight}` || r.endsWith(`/${highlight}`)))
          const isBranchHit = isHoverBranchActive ? Boolean(isBranchActive && branchHashes?.has(commit.hash)) : isCurrentBranchHead || marked
          const rowTintClass = cn(
            isSpotlightHit && spotlightTarget?.role === 'primary'
              ? 'bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] ring-1 ring-inset ring-accent/60'
              : isSpotlightHit
                ? 'bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] ring-1 ring-inset ring-blue-500/40'
                : isLineageHit
                  ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] ring-1 ring-inset ring-accent/35'
                  : ''
          )
          const isHovered = isContextActive || hoveredHash === commit.hash
          const isMerge = commit.parents.length > 1
          const isConflictedMerge = isMerge && Boolean(conflicts?.[commit.hash]?.hasConflict)
          const nodeRadius = isMerge ? (selected ? 8.5 : 4) : selected ? 12.5 : isHead ? 10 : 8
          const nodeX = xAt(point?.lane ?? 0)
          return (
            <li
              key={commit.hash}
              className="group/commit git-commit-row relative z-0 h-[26px] max-h-[26px] min-w-0 shrink-0 overflow-visible hover:z-10"
              onPointerEnter={() => {
                if (isScrollingRef.current) return
                setHoveredHash(commit.hash)
                onClearBranchHover()
              }}
              onPointerLeave={() => {
                if (isScrollingRef.current) return
                setHoveredHash(null)
              }}
            >
              <div
                className="git-graph-col-pill"
                data-selected={selected ? 'true' : 'false'}
                data-branch-hit={isBranchHit ? 'true' : 'false'}
                style={
                  {
                    '--row-tint': color,
                    '--node-x': `${nodeX}px`,
                    '--node-radius': `${nodeRadius}px`,
                  } as React.CSSProperties
                }
              />
              <div
                className="git-message-col-pill"
                data-selected={selected ? 'true' : 'false'}
                data-branch-hit={isBranchHit ? 'true' : 'false'}
                style={{ '--row-tint': color } as React.CSSProperties}
              />
              <div
                role="row"
                tabIndex={0}
                aria-selected={selected}
                data-git-commit-hash={commit.hash}
                className={cn(
                  'group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus:outline-none focus-visible:outline-none transition-opacity duration-150',
                  findNeedle && !findHit && 'opacity-35',
                  isLineageActive && !isLineageHit && !selected && !isHovered && 'opacity-35 hover:opacity-100',
                  isSpotlightDimmed && !selected && !isHovered && 'opacity-35 hover:opacity-100',
                  isHoverBranchActive && isBranchActive && !branchHashes?.has(commit.hash) && !selected && !isHovered && 'opacity-25 hover:opacity-100'
                )}
                style={{ gridTemplateColumns: columns }}
                onClick={() => {
                  const sel = window.getSelection()
                  if (sel && sel.toString().length > 0) return
                  onSelect?.(commit)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect?.(commit)
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  const branchList = [...chips.map((c) => c.label), ...(branch ? [branch] : [])]
                  setContextMenu({
                    type: 'commit',
                    target: 'commit',
                    commit,
                    branches: branchList,
                    color,
                    anchor: { x: event.clientX, y: event.clientY },
                  })
                }}
              >
                <span
                  data-git-branch-cell
                  className="flex h-[26px] min-h-0 min-w-0 items-center justify-start overflow-hidden bg-transparent pl-0.5"
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    const branchList = [...chips.map((c) => c.label), ...(branch ? [branch] : [])]
                    setContextMenu({
                      type: 'commit',
                      target: 'branch',
                      commit,
                      branches: branchList,
                      color,
                      anchor: { x: event.clientX, y: event.clientY },
                    })
                  }}
                >
                  {chips.length > 0 ? (
                    <>
                      <RefChipsCell
                        chips={chips}
                        commit={commit}
                        checkedOut={checkedOut}
                        color={color}
                        remoteNames={remoteNames}
                        onBranchHoverStart={onBranchPointerEnter}
                        onBranchHoverEnd={onBranchPointerLeave}
                        onSelectCommit={onSelect}
                        onCheckoutBranch={onCheckoutBranch}
                        onPushBranch={onPushBranch}
                        onPullBranch={onPullBranch}
                        onCreateBranch={onCreateBranch}
                        onDeleteBranch={onDeleteBranch}
                        onRenameBranch={onRenameBranch}
                        soloBranch={soloBranch}
                        onSoloBranch={onSoloBranch}
                      />
                      {spotlightTarget && <AnnotationBadge target={spotlightTarget} className="ml-1 shrink-0" />}
                      <span
                        className={cn('min-w-2 flex-1', isCommitCurrent ? 'h-0.5' : 'h-px')}
                        style={{
                          background: isCommitCurrent ? color : undefined,
                          backgroundImage: isCommitCurrent ? undefined : `repeating-linear-gradient(to right, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)`,
                          opacity: isCommitCurrent ? 1 : 0.7,
                        }}
                      />
                    </>
                  ) : branch ? (
                    <>
                      <span
                        className={cn(
                          'max-w-full min-w-0 cursor-pointer items-center justify-start truncate rounded-sm px-2 text-[12px] leading-none font-medium select-text',
                          isHovered ? 'inline-flex opacity-[0.85]' : 'hidden opacity-[0.45] group-hover/commit:inline-flex'
                        )}
                        style={{
                          height: BADGE_H,
                          color,
                          background: `color-mix(in oklab, ${color} 16%, var(--panel))`,
                          border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
                        }}
                        title={branch}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect?.(commit)
                        }}
                        onPointerEnter={() => onBranchPointerEnter(branch)}
                        onPointerLeave={onBranchPointerLeave}
                      >
                        {branch}
                      </span>
                      {spotlightTarget && <AnnotationBadge target={spotlightTarget} className="ml-1 shrink-0" />}
                      <span
                        className={cn('h-px min-w-2 flex-1', isHovered ? 'inline-flex opacity-70' : 'hidden opacity-30 group-hover/commit:inline-flex')}
                        style={{
                          backgroundImage: `repeating-linear-gradient(to right, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)`,
                        }}
                      />
                    </>
                  ) : spotlightTarget ? (
                    <>
                      <AnnotationBadge target={spotlightTarget} className="ml-1 shrink-0" />
                      <span
                        className="h-0.5 min-w-2 flex-1"
                        style={{
                          background: `linear-gradient(to right, ${color}, color-mix(in oklab, ${color} 20%, transparent))`,
                          opacity: 0.25,
                        }}
                      />
                    </>
                  ) : null}
                </span>
                <span
                  className="flex h-[26px] min-h-0 items-center justify-end bg-transparent"
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    const branchList = [...chips.map((c) => c.label), ...(branch ? [branch] : [])]
                    setContextMenu({
                      type: 'commit',
                      target: 'graph',
                      commit,
                      branches: branchList,
                      color,
                      anchor: { x: event.clientX, y: event.clientY },
                    })
                  }}
                >
                  <span className="w-0.5 shrink-0" style={{ height: DOT, background: color }} aria-hidden />
                </span>
                <span
                  data-git-message-cell
                  className={cn('flex h-[26px] min-h-0 min-w-0 items-center pl-2', rowTintClass)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    const branchList = [...chips.map((c) => c.label), ...(branch ? [branch] : [])]
                    setContextMenu({
                      type: 'commit',
                      target: 'commit',
                      commit,
                      branches: branchList,
                      color,
                      anchor: { x: event.clientX, y: event.clientY },
                    })
                  }}
                >
                  {isConflictedMerge && <CommitStatusBadge commit={commit} conflict={conflicts?.[commit.hash]} onOpenConflictView={onOpenConflictView} />}
                  <span
                    className="flex min-w-0 flex-1 items-center truncate pr-2 text-sm leading-none font-normal select-text cursor-pointer transition-colors duration-150 text-ink"
                    style={{ height: DOT }}
                    title={`${commit.short || commit.hash.slice(0, 7)} · ${commit.author} (${commit.date})\n${commit.subject}`}
                  >
                    {commit.subject}
                  </span>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <GraphNodesOverlay
        graphScrollRef={graphScrollRef}
        syncGraphEdge={syncGraphEdge}
        contentWidth={contentWidth}
        scene={scene}
        commits={commits}
        lineageHashes={lineageHashes}
        spotlightHashes={spotlightHashes}
        spotlightMap={spotlightMap}
        isSpotlightActive={isSpotlightActive}
        isHoverBranchActive={isHoverBranchActive}
        isBranchActive={isBranchActive}
        branchHashes={branchHashes}
        remoteNames={remoteNames}
        hiddenRemotes={hiddenRemotes}
        soloRemote={soloRemote}
        branchAt={branchAt}
        contextMenu={contextMenu}
        hoveredHash={hoveredHash}
        checkedOut={checkedOut}
        headIndex={headIndex}
        currentBranch={currentBranch}
        selectedHash={selectedHash}
        visibleStashes={visibleStashes}
        conflicts={conflicts}
        isScrollingRef={isScrollingRef}
        hoveredNode={hoveredNode}
        setHoveredHash={setHoveredHash}
        setHoveredNode={setHoveredNode}
        setContextMenu={setContextMenu}
        onSelect={onSelect}
        locale={locale}
        t={t}
      />
      {graphRightEdgeFade ? (
        <div
          className="pointer-events-none absolute top-0 z-[3] h-full w-4 bg-[linear-gradient(to_left,color-mix(in_oklab,var(--panel)_88%,transparent),transparent)]"
          style={{ left: 'calc(var(--git-branch-w) + var(--git-graph-w) - 1rem)', height: scene.height }}
          aria-hidden
        />
      ) : null}
    </div>
  )
})
