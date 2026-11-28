'use client'

import { type CSSProperties, Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { measureCellsFit } from '@/components/git/fitColumn'
import { setGitUiDebugHoldGapLoading, setGitUiDebugPreviewGapStrip, useGitUiDebugHoldGapLoading, useGitUiDebugPreviewGapStrip } from '@/components/git/git-ui-debug'
import { GitGapStrip } from '@/components/git/graph/GitGapStrip'
import { buildCommitContextItems, buildStashContextItems, buildWorktreeContextItems } from '@/components/git/graph/graphContextItems'
import type { GraphOverlayHoverNode } from '@/components/git/graph/GraphNodesOverlay'
import { BRANCH_DEFAULT, BRANCH_MIN, type GitGraphProps, GRAPH_DEFAULT_WIDTH, GRAPH_MIN, type GraphContextMenu, MESSAGE_MIN } from '@/components/git/graph/GraphPrimitives'
import { GraphSegmentView } from '@/components/git/graph/GraphSegmentView'
import { useGraphPanning } from '@/components/git/graph/useGraphPanning'
import { PanelSplitter } from '@/components/git/PanelSplitter'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { EmptyState, ScrollArea } from '@/components/sk'
import { useOptionalSpotlight } from '@/lib/agent/spotlight-context'
import { copyToClipboard } from '@/lib/clipboard'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'
import { getGitDriver } from '@/lib/git/driver'
import { COL, graphScene, PAD } from '@/lib/git/graph-scene'
import type { GitHistorySegment } from '@/lib/git/history-segments'
import { getBranchCommitHashes } from '@/lib/git/topology'
import { type GitCommit, type GitStash, type GitWorktree } from '@/lib/git/types'
import { isPositiveNumber, repoPrefKey, useGitUiPref, useGitUiReady } from '@/lib/git/ui-prefs'

function assignStashesToSegment(segment: GitHistorySegment, segmentIndex: number, totalSegments: number, stashes: GitStash[]): GitStash[] {
  if (totalSegments <= 1) return stashes
  const commitSet = new Set(segment.commits.map((c) => c.hash))
  return stashes.filter((stash) => {
    const matchedBase = commitSet.has(stash.base) || segment.commits.some((c) => c.hash.startsWith(stash.base) || stash.base.startsWith(c.hash))
    if (matchedBase) return true
    return segmentIndex === 0 && segment.startIndex === 0
  })
}

function GitGraphComponent({
  repo,
  remoteUrl,
  commits,
  segments,
  loadingPrevSegmentId,
  registerGapSentinel,
  onLoadPrevSegment,
  onJumpTop,
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

  const handleClearBranchHover = useCallback(() => {
    if (internalHoverBranch || activeHoverBranch) {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      setInternalHoverBranch(null)
      onBranchHoverEnd?.()
    }
  }, [activeHoverBranch, internalHoverBranch, onBranchHoverEnd])

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
  const debugGapPreview = useGitUiDebugPreviewGapStrip()
  const debugGapLoading = useGitUiDebugHoldGapLoading()

  const baseSegments = useMemo<GitHistorySegment[]>(() => {
    if (segments && segments.length > 0) {
      return segments.filter((seg) => seg.commits.length > 0)
    }
    return commits.length > 0 || worktree || visibleStashes.length > 0 ? [{ id: 'default', startIndex: 0, commits, hasMore: false }] : []
  }, [segments, commits, worktree, visibleStashes.length])

  const isDebugSplitActive = Boolean((debugGapPreview || debugGapLoading) && baseSegments.length === 1 && baseSegments[0].commits.length >= 6)

  const resolvedSegments = useMemo<GitHistorySegment[]>(() => {
    if (!isDebugSplitActive) return baseSegments
    const source = baseSegments[0]
    const splitAt = Math.min(6, source.commits.length - 3)
    return [
      { id: `${source.id}-debug-top`, startIndex: source.startIndex, commits: source.commits.slice(0, splitAt), hasMore: true },
      { id: `${source.id}-debug-bot`, startIndex: source.startIndex + splitAt + 477, commits: source.commits.slice(splitAt), hasMore: source.hasMore },
    ]
  }, [baseSegments, isDebugSplitActive])

  const segmentScenes = useMemo(
    () =>
      resolvedSegments.map((segment, index) => {
        const prevSegment = index > 0 ? resolvedSegments[index - 1] : null
        const nextSegment = index < resolvedSegments.length - 1 ? resolvedSegments[index + 1] : null
        const continuesAbove = segment.startIndex > 0 && (!prevSegment || segment.startIndex > prevSegment.startIndex + prevSegment.commits.length)
        const continuesBelow = Boolean(nextSegment && nextSegment.startIndex > segment.startIndex + segment.commits.length)
        const segWorktree = segment.startIndex === 0 ? worktree : null
        const segStashes = assignStashesToSegment(segment, index, resolvedSegments.length, visibleStashes)
        return {
          segment,
          worktree: segWorktree,
          stashes: segStashes,
          scene: graphScene(segment.commits, segWorktree, segStashes, { continuesAbove, continuesBelow }),
        }
      }),
    [resolvedSegments, worktree, visibleStashes]
  )

  const contentWidth = useMemo(() => Math.max(...segmentScenes.map((entry) => PAD + entry.scene.laneCount * COL), GRAPH_MIN), [segmentScenes])

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
    const node = graphScrollRef.current || frameRef.current?.querySelector<HTMLDivElement>('[data-git-graph-pan]')
    if (!node) return
    const max = Math.max(0, node.scrollWidth - node.clientWidth)
    setGraphEdge({ left: node.scrollLeft > 1, right: node.scrollLeft < max - 1, scrollLeft: node.scrollLeft })
    frameRef.current?.style.setProperty('--git-graph-scroll-x', `${node.scrollLeft}px`)
    if (frameRef.current) {
      for (const el of frameRef.current.querySelectorAll<HTMLElement>('[data-git-graph-pan]')) {
        if (el !== node && Math.abs(el.scrollLeft - node.scrollLeft) > 0.5) {
          el.scrollLeft = node.scrollLeft
        }
      }
    }
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
    if (frameRef.current) {
      for (const el of frameRef.current.querySelectorAll<HTMLElement>('[data-git-graph-pan]')) {
        el.scrollLeft = 0
      }
    }
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

  if (commits.length === 0 && !worktree && stashes.length === 0) {
    return <EmptyState title={t('git.graph.noCommits')} message={t('git.graph.noCommitsMessage')} density="panel" />
  }

  const firstSegment = segmentScenes[0]?.segment

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
          {firstSegment && firstSegment.startIndex > 0 ? (
            <div ref={(el) => registerGapSentinel?.(firstSegment.id, el)} data-git-gap-segment={firstSegment.id}>
              <GitGapStrip
                columns={columns}
                contentWidth={contentWidth}
                hiddenCount={firstSegment.startIndex}
                lowerRails={segmentScenes[0]?.scene.topRails}
                loading={loadingPrevSegmentId === firstSegment.id || debugGapLoading}
                canJumpTop={Boolean(onJumpTop)}
                onLoadPrev={onLoadPrevSegment ? () => onLoadPrevSegment(firstSegment.id) : undefined}
                onJumpTop={onJumpTop}
              />
            </div>
          ) : null}
          {segmentScenes.map((entry, idx) => {
            const prevEntry = idx > 0 ? segmentScenes[idx - 1] : null
            const gapCount = prevEntry ? Math.max(0, entry.segment.startIndex - (prevEntry.segment.startIndex + prevEntry.segment.commits.length)) : 0
            return (
              <Fragment key={entry.segment.id}>
                {prevEntry && gapCount > 0 ? (
                  <div ref={(el) => registerGapSentinel?.(entry.segment.id, el)} data-git-gap-segment={entry.segment.id}>
                    <GitGapStrip
                      columns={columns}
                      contentWidth={contentWidth}
                      hiddenCount={gapCount}
                      upperRails={prevEntry.scene.bottomRails}
                      lowerRails={entry.scene.topRails}
                      loading={loadingPrevSegmentId === entry.segment.id || debugGapLoading}
                      canJumpTop={Boolean(onJumpTop)}
                      onLoadPrev={
                        !isDebugSplitActive && onLoadPrevSegment
                          ? () => onLoadPrevSegment(entry.segment.id)
                          : () => {
                              setGitUiDebugPreviewGapStrip(false)
                              setGitUiDebugHoldGapLoading(false)
                            }
                      }
                      onJumpTop={onJumpTop}
                    />
                  </div>
                ) : null}
                <GraphSegmentView
                  segmentId={entry.segment.id}
                  commits={entry.segment.commits}
                  scene={entry.scene}
                  worktree={entry.worktree}
                  visibleStashes={entry.stashes}
                  contentWidth={contentWidth}
                  columns={columns}
                  selectedHash={selectedHash}
                  findNeedle={findNeedle}
                  highlight={highlight}
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
                  soloBranch={soloBranch}
                  checkedOut={checkedOut}
                  currentBranch={currentBranch}
                  conflicts={conflicts}
                  contextMenu={contextMenu}
                  hoveredHash={hoveredHash}
                  hoveredNode={hoveredNode}
                  isScrollingRef={isScrollingRef}
                  graphScrollRef={graphScrollRef}
                  syncGraphEdge={syncGraphEdge}
                  graphRightEdgeFade={graphEdge.right}
                  setContextMenu={setContextMenu}
                  setHoveredHash={setHoveredHash}
                  setHoveredNode={setHoveredNode}
                  onSelect={onSelect}
                  onSelectWorktree={onSelectWorktree}
                  onOpenConflictView={onOpenConflictView}
                  onCheckoutBranch={onCheckoutBranch}
                  onPushBranch={onPushBranch}
                  onPullBranch={onPullBranch}
                  onCreateBranch={onCreateBranch}
                  onDeleteBranch={onDeleteBranch}
                  onRenameBranch={onRenameBranch}
                  onSoloBranch={onSoloBranch}
                  onBranchPointerEnter={handleBranchPointerEnter}
                  onBranchPointerLeave={handleBranchPointerLeave}
                  onClearBranchHover={handleClearBranchHover}
                  locale={locale}
                  t={t}
                />
              </Fragment>
            )
          })}
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
