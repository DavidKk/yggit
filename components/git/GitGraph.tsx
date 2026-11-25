'use client'

import { type CSSProperties, Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AnnotationBadge } from '@/components/git/agent/spotlight/AnnotationBadge'
import { CommitStatusBadge } from '@/components/git/CommitStatusBadge'
import { measureCellsFit } from '@/components/git/fitColumn'
import { buildCommitContextItems, buildStashContextItems, buildWorktreeContextItems } from '@/components/git/graph/graphContextItems'
import { GraphNodesOverlay, type GraphOverlayHoverNode } from '@/components/git/graph/GraphNodesOverlay'
import {
  BADGE_H,
  BRANCH_DEFAULT,
  BRANCH_MIN,
  commitFindHit,
  type GitGraphProps,
  GRAPH_DEFAULT_WIDTH,
  GRAPH_MIN,
  type GraphContextMenu,
  isCommitCurrentBranch,
  MESSAGE_MIN,
  toDateKey,
} from '@/components/git/graph/GraphPrimitives'
import { DateBoundaryDividers, StashRow, WorktreeRow } from '@/components/git/graph/GraphSpecialRows'
import { useGraphPanning } from '@/components/git/graph/useGraphPanning'
import { PanelSplitter } from '@/components/git/PanelSplitter'
import { branchAtCommits, FloatingMenu, type FloatingMenuItem, refChips, RefChipsCell } from '@/components/git/RefChipsCell'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { EmptyState, ScrollArea } from '@/components/sk'
import { useOptionalSpotlight } from '@/lib/agent/spotlight-context'
import { copyToClipboard } from '@/lib/clipboard'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'
import { getGitDriver } from '@/lib/git/driver'
import { COL, DOT, graphScene, laneColor, PAD, xAt } from '@/lib/git/graph-scene'
import { getBranchCommitHashes } from '@/lib/git/topology'
import { type GitCommit, type GitStash, type GitWorktree } from '@/lib/git/types'
import { isPositiveNumber, repoPrefKey, useGitUiPref, useGitUiReady } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'
function GitGraphComponent({
  repo,
  remoteUrl,
  commits,
  worktree,
  stashes = [],
  highlight,
  lineageHashes,
  remoteNames = [],
  worktreeBranches = [],
  selectedHash,
  activeHoverBranch,
  onBranchHoverStart,
  onBranchHoverEnd,
  findNeedle = '',
  scrollRef,
  header,
  footer,
  conflicts,
  onSelect,
  onSelectWorktree,
  onOpenConflictView,
  onCheckoutBranch,
  onPushBranch,
  onPullBranch,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  onRefresh,
  currentBranch,
  soloBranch,
  onSoloBranch,
  soloRemote,
  hiddenRemotes,
}: GitGraphProps) {
  const t = useT()
  const locale = useLocaleCode()
  const notify = useNotification()
  const [contextConfig] = useContextMenuConfig()
  const spotlight = useOptionalSpotlight()
  const isSpotlightActive = Boolean(spotlight?.active && spotlight.targets.length > 0)
  const spotlightMap = spotlight?.targetsMap
  const [contextMenu, setContextMenu] = useState<GraphContextMenu | null>(null)
  const [hoveredHash, setHoveredHash] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphOverlayHoverNode | null>(null)
  const isScrollingRef = useRef(false)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleListScroll = useCallback(() => {
    isScrollingRef.current = true
    if (scrollTimerRef.current !== null) {
      clearTimeout(scrollTimerRef.current)
    }
    scrollTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false
    }, 120)
  }, [])

  const [internalHoverBranch, setInternalHoverBranch] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBranchPointerEnter = useCallback(
    (branchName: string) => {
      if (!branchName) return
      onBranchHoverStart?.(branchName)
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = setTimeout(() => {
        setInternalHoverBranch(branchName)
      }, 1000)
    },
    [onBranchHoverStart]
  )

  const handleBranchPointerLeave = useCallback(() => {
    onBranchHoverEnd?.()
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setInternalHoverBranch(null)
  }, [onBranchHoverEnd])

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const isHoverBranchActive = Boolean(activeHoverBranch ?? internalHoverBranch)
  const activeBranch = activeHoverBranch ?? internalHoverBranch ?? currentBranch
  const branchHashes = useMemo(() => {
    if (!activeBranch) return null
    return getBranchCommitHashes(activeBranch, commits)
  }, [activeBranch, commits])
  const isBranchActive = Boolean(branchHashes && branchHashes.size > 0)

  const spotlightHashes = useMemo(() => {
    if (!spotlightMap || spotlightMap.size === 0) return null
    return new Set(Array.from(spotlightMap.keys()))
  }, [spotlightMap])

  const copyValue = async (value: string) => {
    const ok = await copyToClipboard(value)
    if (ok) notify.success(t('common.copied'))
    else notify.error(t('common.copyFailed'))
  }

  const commitContextItems = (commit: GitCommit, branchNames?: string[] | string, target?: 'branch' | 'commit' | 'graph'): FloatingMenuItem[] =>
    buildCommitContextItems({
      commit,
      branchNames,
      target,
      repo,
      remoteUrl,
      remoteNames,
      worktreeBranches,
      worktree,
      soloBranch,
      onSoloBranch,
      contextConfig,
      t,
      notify,
      onCheckoutBranch,
      onPushBranch,
      onPullBranch,
      onCreateBranch,
      onDeleteBranch,
      onRenameBranch,
      headCommitHash: commits[0]?.hash,
      onRefresh,
    })

  const worktreeContextItems = (wt: GitWorktree): FloatingMenuItem[] => buildWorktreeContextItems({ wt, repo, t, copyValue, onSelectWorktree })

  const handleStashAction = async (action: 'apply' | 'pop' | 'drop' | 'edit', index: number, message?: string) => {
    if (!repo) return
    try {
      const driver = getGitDriver()
      const res = await driver.stash(repo, { action, index, message })
      notify.success(res.message || 'Operation succeeded')
      await onRefresh?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  const stashContextItems = (stash: GitStash): FloatingMenuItem[] =>
    buildStashContextItems({
      stash,
      repo,
      t,
      copyValue,
      onStashAction: handleStashAction,
      onHideStash: (name) => setHiddenStashes((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name])),
    })

  const [hiddenStashes, setHiddenStashes] = useGitUiPref(repo ? repoPrefKey(repo, 'hiddenStashes') : 'git.hiddenStashes.none', [] as string[], Array.isArray)
  const visibleStashes = useMemo(() => stashes.filter((s) => !hiddenStashes.includes(s.name)), [stashes, hiddenStashes])
  const scene = useMemo(() => graphScene(commits, worktree, visibleStashes), [commits, worktree, visibleStashes])
  const { points, headIndex } = scene
  const contentWidth = PAD + scene.laneCount * COL
  const [branchWidth, setBranchWidth] = useGitUiPref('graph.branchWidth', BRANCH_DEFAULT, isPositiveNumber)
  const [graphView, setGraphView] = useGitUiPref('graph.viewWidth', GRAPH_DEFAULT_WIDTH, isPositiveNumber)
  const prefsReady = useGitUiReady()
  const [graphEdge, setGraphEdge] = useState({ left: false, right: false, scrollLeft: 0 })
  const frameRef = useRef<HTMLDivElement>(null)
  const graphScrollRef = useRef<HTMLDivElement>(null)
  const branchRef = useRef(branchWidth)
  const graphRef = useRef(graphView)
  const cachedRoomRef = useRef<number | null>(null)
  const columns = `var(--git-branch-w) var(--git-graph-w) minmax(${MESSAGE_MIN}px, 1fr)`

  // Defer inline vars until hydrate so GitUiBootScript values win on first paint.
  const frameStyle = (
    prefsReady
      ? {
          ['--git-branch-w']: `${branchWidth}px`,
          ['--git-graph-w']: `${graphView}px`,
        }
      : {}
  ) as CSSProperties

  const syncGraphEdge = useCallback(() => {
    const node = graphScrollRef.current
    if (!node) return
    const max = Math.max(0, node.scrollWidth - node.clientWidth)
    setGraphEdge({ left: node.scrollLeft > 1, right: node.scrollLeft < max - 1, scrollLeft: node.scrollLeft })
    frameRef.current?.style.setProperty('--git-graph-scroll-x', `${node.scrollLeft}px`)
  }, [])

  useEffect(() => {
    branchRef.current = branchWidth
    graphRef.current = graphView
    document.documentElement.style.setProperty('--git-branch-w', `${branchWidth}px`)
    document.documentElement.style.setProperty('--git-graph-w', `${graphView}px`)
    frameRef.current?.style.setProperty('--git-graph-scroll-x', '0px')
    requestAnimationFrame(syncGraphEdge)
  }, [branchWidth, graphView, syncGraphEdge])
  const checkedOut = useMemo(() => new Set(worktreeBranches), [worktreeBranches])
  const branchAt = useMemo(() => branchAtCommits(commits, points, remoteNames), [commits, points, remoteNames])
  const room = () => cachedRoomRef.current ?? (cachedRoomRef.current = frameRef.current?.clientWidth ?? 960)
  const applyBranch = (next: number) => {
    branchRef.current = next
    frameRef.current?.style.setProperty('--git-branch-w', `${next}px`)
  }
  const applyGraph = (next: number) => {
    graphRef.current = next
    frameRef.current?.style.setProperty('--git-graph-w', `${next}px`)
  }
  const resizeBranch = (delta: number) => {
    const max = Math.max(BRANCH_MIN, room() - graphRef.current - MESSAGE_MIN)
    applyBranch(Math.min(max, Math.max(BRANCH_MIN, branchRef.current + delta)))
  }
  const resizeGraph = (delta: number) => {
    const max = Math.max(GRAPH_MIN, room() - branchRef.current - MESSAGE_MIN)
    applyGraph(Math.min(max, Math.max(GRAPH_MIN, graphRef.current + delta)))
  }
  const commitBranch = () => {
    cachedRoomRef.current = null
    setBranchWidth(branchRef.current)
  }
  const commitGraph = () => {
    cachedRoomRef.current = null
    setGraphView(graphRef.current)
    requestAnimationFrame(syncGraphEdge)
  }
  const fitBranch = () => {
    const frame = frameRef.current
    if (!frame) return
    const measured = measureCellsFit(frame, '[data-git-branch-cell]')
    const fitted = Math.max(BRANCH_MIN, measured)
    const max = Math.max(BRANCH_MIN, room() - graphRef.current - MESSAGE_MIN)
    const next = Math.max(BRANCH_MIN, Math.min(max, fitted))
    applyBranch(next)
    setBranchWidth(next)
  }
  const fitGraph = () => {
    const max = Math.max(GRAPH_MIN, room() - branchRef.current - MESSAGE_MIN)
    const target = Math.max(GRAPH_MIN, contentWidth)
    const next = Math.max(GRAPH_MIN, Math.min(max, target))
    applyGraph(next)
    setGraphView(next)
    const node = graphScrollRef.current
    if (node) node.scrollLeft = 0
    requestAnimationFrame(syncGraphEdge)
  }

  useEffect(() => {
    const max = Math.max(GRAPH_MIN, room() - branchRef.current - MESSAGE_MIN)
    if (graphRef.current > max) {
      applyGraph(max)
      setGraphView(max)
    }
    requestAnimationFrame(syncGraphEdge)
  }, [contentWidth, setGraphView, syncGraphEdge])

  // Native wheel and drag-pan interactions for the graph column
  useGraphPanning({
    frameRef,
    graphScrollRef,
    branchRef,
    graphRef,
    contentWidth,
    syncGraphEdge,
  })

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

  if (commits.length === 0 && !worktree && stashes.length === 0) {
    return <EmptyState title={t('git.graph.noCommits')} message={t('git.graph.noCommitsMessage')} density="panel" />
  }

  return (
    <div ref={frameRef} className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={frameStyle}>
      <header className="relative z-20 shrink-0 select-none bg-panel">
        <div className="grid h-8 items-center text-xs text-ink-soft" style={{ gridTemplateColumns: columns }}>
          <span
            className="cursor-pointer px-2 text-left transition-colors hover:text-ink"
            title={t('git.graph.resizeBranch')}
            onDoubleClick={(e) => {
              e.preventDefault()
              fitBranch()
            }}
          >
            {t('git.graph.colBranch')}
          </span>
          <span
            className="cursor-pointer px-2 transition-colors hover:text-ink"
            title={t('git.graph.resizeGraph')}
            onDoubleClick={(e) => {
              e.preventDefault()
              fitGraph()
            }}
          >
            {t('git.graph.colGraph')}
          </span>
          <span className="min-w-0 truncate pl-2">{t('git.graph.colMessage')}</span>
        </div>
        <div className="absolute inset-y-0 left-[var(--git-branch-w)] z-30 w-0">
          <PanelSplitter
            label={t('git.graph.resizeBranch')}
            value={branchWidth}
            min={BRANCH_MIN}
            max={640}
            line
            onResize={resizeBranch}
            onResizeEnd={commitBranch}
            onAutoFit={fitBranch}
          />
        </div>
        <div className="absolute inset-y-0 z-30 w-0" style={{ left: 'calc(var(--git-branch-w) + var(--git-graph-w))' }}>
          <PanelSplitter
            label={t('git.graph.resizeGraph')}
            value={graphView}
            min={GRAPH_MIN}
            max={960}
            line
            onResize={resizeGraph}
            onResizeEnd={commitGraph}
            onAutoFit={fitGraph}
          />
        </div>
      </header>
      <ScrollArea
        className="min-h-0 min-w-0 flex-1"
        indicator="both"
        reserveGutter={false}
        scrollRef={scrollRef}
        scrollProps={{ 'aria-label': t('git.graph.historyAria'), onScroll: handleListScroll }}
      >
        <div className="relative min-w-0" style={{ overflowAnchor: 'none' }}>
          {header}
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
              const marked = Boolean(
                highlight && commit.refs.some((r) => r === highlight || r === `HEAD -> ${highlight}` || r === `tag: ${highlight}` || r.endsWith(`/${highlight}`))
              )
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
                    if (internalHoverBranch || activeHoverBranch) {
                      if (hoverTimerRef.current) {
                        clearTimeout(hoverTimerRef.current)
                        hoverTimerRef.current = null
                      }
                      setInternalHoverBranch(null)
                      onBranchHoverEnd?.()
                    }
                  }}
                  onPointerLeave={() => {
                    if (isScrollingRef.current) return
                    setHoveredHash(null)
                  }}
                >
                  {/* Seamless dual highlight pills across graph and message columns */}
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
                            onBranchHoverStart={handleBranchPointerEnter}
                            onBranchHoverEnd={handleBranchPointerLeave}
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
                            onPointerEnter={() => handleBranchPointerEnter(branch)}
                            onPointerLeave={handleBranchPointerLeave}
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

          {graphEdge.right ? (
            <div
              className="pointer-events-none absolute top-0 z-[3] h-full w-4 bg-[linear-gradient(to_left,color-mix(in_oklab,var(--panel)_88%,transparent),transparent)]"
              style={{ left: 'calc(var(--git-branch-w) + var(--git-graph-w) - 1rem)', height: scene.height }}
              aria-hidden
            />
          ) : null}
          {contextMenu ? (
            <FloatingMenu
              anchor={contextMenu.anchor}
              ariaLabel={contextMenu.type === 'commit' ? contextMenu.commit.subject : contextMenu.type === 'stash' ? contextMenu.stash.name : 'Worktree'}
              color={contextMenu.color}
              onClose={() => setContextMenu(null)}
              items={
                contextMenu.type === 'commit'
                  ? commitContextItems(contextMenu.commit, contextMenu.branches, contextMenu.target)
                  : contextMenu.type === 'stash'
                    ? stashContextItems(contextMenu.stash)
                    : worktreeContextItems(contextMenu.worktree)
              }
            />
          ) : null}
          {footer}
        </div>
      </ScrollArea>
      {/* Bottom horizontal scroll indicator bar for graph column */}
      {contentWidth > graphView && (
        <div
          className="pointer-events-none absolute bottom-0 z-30 h-1 overflow-hidden"
          style={{
            left: 'var(--git-branch-w)',
            width: 'var(--git-graph-w)',
          }}
          aria-hidden
        >
          <div
            className="h-0.5 rounded-full bg-[color-mix(in_oklab,var(--ink-soft)_50%,transparent)] shadow-xs transition-transform duration-75"
            style={{
              width: `${Math.max(18, (graphView / contentWidth) * graphView)}px`,
              transform: `translateX(${(graphEdge.scrollLeft / Math.max(1, contentWidth - graphView)) * (graphView - Math.max(18, (graphView / contentWidth) * graphView))}px)`,
            }}
          />
        </div>
      )}
    </div>
  )
}

export const GitGraph = memo(GitGraphComponent)
