'use client'

import { type CSSProperties, memo, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuClock, LuCopy, LuGitBranch, LuHash, LuInbox, LuShare2, LuText, LuUser } from 'react-icons/lu'

import { AnnotationBadge } from '@/components/git/agent/spotlight/AnnotationBadge'
import { measureCellsFit } from '@/components/git/fitColumn'
import { PanelSplitter } from '@/components/git/PanelSplitter'
import { branchAtCommits, type FloatingAnchor, FloatingMenu, type FloatingMenuItem, refChips, RefChipsCell } from '@/components/git/RefChipsCell'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { EmptyState, ScrollArea, Tooltip } from '@/components/sk'
import { useOptionalSpotlight } from '@/lib/agent/spotlight-context'
import { copyToClipboard } from '@/lib/clipboard'
import { formatCommitDateDivider } from '@/lib/git/format-commit-ago'
import { COL, DOT, graphScene, isHighlightedStroke, laneColor, PAD, ROW, type Stroke, xAt } from '@/lib/git/graph-scene'
import { makeShareUrl } from '@/lib/git/resolver'
import { formatIssueShareCard, makeIssueShareUrl } from '@/lib/git/share-card'
import { getBranchCommitHashes } from '@/lib/git/topology'
import { GIT_WORKTREE_HASH, type GitCommit, type GitStash, gitStashAsCommit, type GitWorktree } from '@/lib/git/types'
import { isPositiveNumber, useGitUiPref, useGitUiReady } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

const BADGE_H = DOT
const NODE_DOT = 16
const MERGE_NODE_DOT = 8

type GraphContextMenu =
  | {
      type: 'commit'
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

const BRANCH_MIN = 130
const MESSAGE_MIN = 140
const BRANCH_DEFAULT = 160
const GRAPH_MIN = 80
const GRAPH_DEFAULT_WIDTH = 240

type Props = {
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
  /** When set, non-matching commits are dimmed (find overlay); list length stays stable. */
  findNeedle?: string
  /** Scrollport for the commit list (header stays outside). */
  scrollRef?: Ref<HTMLDivElement>
  /** Rendered at the end of the scrollable list (e.g. infinite-scroll sentinel). */
  footer?: ReactNode
  onSelect?: (commit: GitCommit) => void
  onSelectWorktree?: () => void
}

function toDateKey(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function stashFindHit(stash: GitStash, needle: string) {
  if (!needle) return true
  const hay = `${stash.subject}\n${stash.name}\n${stash.hash}`.toLowerCase()
  return hay.includes(needle)
}

function commitFindHit(commit: GitCommit, needle: string) {
  if (!needle) return true
  const hay = `${commit.subject}\n${commit.author}\n${commit.hash}\n${commit.refs.join('\n')}`.toLowerCase()
  return hay.includes(needle)
}

function refHit(ref: string, name: string): boolean {
  return ref === name || ref === `HEAD -> ${name}` || ref === `tag: ${name}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return [...parts[0]][0]?.toUpperCase() || '?'
  return `${[...parts[0]][0] || ''}${[...parts[1]][0] || ''}`.toUpperCase()
}

/** Memoized SVG tree branch strokes layer to prevent re-renders on hover or loading state. */
const GraphStrokes = memo(function GraphStrokes({
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
  footer,
  onSelect,
  onSelectWorktree,
}: Props) {
  const t = useT()
  const locale = useLocaleCode()
  const notify = useNotification()
  const spotlight = useOptionalSpotlight()
  const isSpotlightActive = Boolean(spotlight?.active && spotlight.targets.length > 0)
  const spotlightMap = spotlight?.targetsMap
  const [contextMenu, setContextMenu] = useState<GraphContextMenu | null>(null)

  const [internalHoverBranch, setInternalHoverBranch] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBranchPointerEnter = useCallback(
    (branchName: string) => {
      if (!branchName) return
      onBranchHoverStart?.(branchName)
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = setTimeout(() => {
        setInternalHoverBranch(branchName)
      }, 3000)
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

  const activeBranch = activeHoverBranch ?? internalHoverBranch
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

  const commitContextItems = (commit: GitCommit, branchNames?: string[] | string): FloatingMenuItem[] => {
    const rawList = Array.isArray(branchNames) ? branchNames : branchNames ? [branchNames] : []
    const branches = Array.from(new Set(rawList.filter(Boolean)))
    const items: FloatingMenuItem[] = []
    for (const b of branches) {
      items.push({
        key: `branch-${b}`,
        label: `${t('git.graph.copyBranchName')} (${b})`,
        icon: <LuGitBranch className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => void copyValue(b),
        group: '复制',
      })
    }
    items.push(
      {
        key: 'share-link',
        label: t('git.graph.copyShareUrl'),
        icon: <LuShare2 className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => {
          const shareUrl = makeShareUrl(repo || '', commit.hash, remoteUrl)
          const full = typeof window !== 'undefined' ? `${window.location.origin}${shareUrl}` : shareUrl
          void copyValue(full)
        },
        group: '复制',
      },
      {
        key: 'share-issue-card',
        label: t('git.commit.copyIssueCard'),
        icon: <LuShare2 className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => {
          const fullShareUrl =
            typeof window !== 'undefined'
              ? `${window.location.origin}${makeIssueShareUrl({
                  repoName: (repo || '').split('/').pop() || repo || '',
                  repoPathOrUrl: repo || '',
                  remoteUrl,
                  commit,
                })}`
              : makeIssueShareUrl({
                  repoName: (repo || '').split('/').pop() || repo || '',
                  repoPathOrUrl: repo || '',
                  remoteUrl,
                  commit,
                })
          const card = formatIssueShareCard(
            {
              repoName: (repo || '').split('/').pop() || repo || '',
              repoPathOrUrl: repo || '',
              remoteUrl,
              commit,
            },
            fullShareUrl
          )
          void copyValue(card.markdown)
        },
        group: '复制',
      },
      {
        key: 'subject',
        label: t('git.graph.copyCommitSubject'),
        icon: <LuText className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => void copyValue(commit.subject),
        group: '复制',
      },
      {
        key: 'hash',
        label: t('git.graph.copyCommitHash'),
        icon: <LuHash className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => void copyValue(commit.hash),
        group: '复制',
      },
      {
        key: 'short-hash',
        label: `${t('git.graph.copyCommitHash')} (Short: ${commit.short || commit.hash.slice(0, 7)})`,
        icon: <LuHash className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => void copyValue(commit.short || commit.hash.slice(0, 7)),
        group: '复制',
      },
      {
        key: 'author',
        label: `${t('git.graph.copyAuthor')} (${commit.author})`,
        icon: <LuUser className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => void copyValue(commit.author),
        group: '复制',
      }
    )
    if (commit.date) {
      items.push({
        key: 'date',
        label: `${t('git.graph.copyDate')} (${commit.date})`,
        icon: <LuClock className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => void copyValue(commit.date),
        group: '复制',
      })
    }
    return items
  }

  const worktreeContextItems = (wt: GitWorktree): FloatingMenuItem[] => [
    {
      key: 'status',
      label: t('git.graph.copyWorktreeChanges'),
      icon: <LuCopy className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () =>
        void copyValue(
          wt.insertions || wt.deletions
            ? `${t('git.graph.workingTree')}: +${wt.insertions} -${wt.deletions} (${t('git.graph.filesCount', { count: wt.files })})`
            : `${t('git.graph.workingTree')}: ${t('git.graph.filesCount', { count: wt.files })}`
        ),
      group: '复制',
    },
  ]

  const stashContextItems = (stash: GitStash): FloatingMenuItem[] => [
    {
      key: 'subject',
      label: t('git.graph.copyStashSubject'),
      icon: <LuText className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () => void copyValue(stash.subject || stash.name),
      group: '复制',
    },
    {
      key: 'name',
      label: `${t('git.graph.copyStashName')} (${stash.name})`,
      icon: <LuCopy className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () => void copyValue(stash.name),
      group: '复制',
    },
    {
      key: 'base',
      label: t('git.graph.copyStashBase'),
      icon: <LuHash className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () => void copyValue(stash.base),
      group: '复制',
    },
  ]

  const scene = useMemo(() => graphScene(commits, worktree, stashes), [commits, worktree, stashes])
  const { points, headIndex } = scene
  const contentWidth = PAD + scene.laneCount * COL
  const [branchWidth, setBranchWidth] = useGitUiPref('graph.branchWidth', BRANCH_DEFAULT, isPositiveNumber)
  const [graphView, setGraphView] = useGitUiPref('graph.viewWidth', GRAPH_DEFAULT_WIDTH, isPositiveNumber)
  const prefsReady = useGitUiReady()
  const [graphEdge, setGraphEdge] = useState({ left: false, right: false })
  const frameRef = useRef<HTMLDivElement>(null)
  const graphScrollRef = useRef<HTMLDivElement>(null)
  const branchRef = useRef(branchWidth)
  const graphRef = useRef(graphView)
  const cachedRoomRef = useRef<number | null>(null)
  const panRef = useRef<{ x: number; y: number; left: number; moved: boolean } | null>(null)
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

  useEffect(() => {
    document.documentElement.style.setProperty('--git-branch-w', `${branchWidth}px`)
    document.documentElement.style.setProperty('--git-graph-w', `${graphView}px`)
  }, [branchWidth, graphView])
  const checkedOut = useMemo(() => new Set(worktreeBranches), [worktreeBranches])
  const branchAt = useMemo(() => branchAtCommits(commits, points, remoteNames), [commits, points, remoteNames])
  const room = () => cachedRoomRef.current ?? (cachedRoomRef.current = frameRef.current?.clientWidth ?? 960)
  const syncGraphEdge = () => {
    const node = graphScrollRef.current
    if (!node) return
    const max = Math.max(0, node.scrollWidth - node.clientWidth)
    setGraphEdge({ left: node.scrollLeft > 1, right: node.scrollLeft < max - 1 })
  }
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
  }, [contentWidth, setGraphView])

  const selectCommitAtGraphY = (clientY: number, top: number) => {
    const hit = scene.rows[Math.floor((clientY - top) / ROW)]
    if (!hit) return
    if (hit.kind === 'worktree') onSelectWorktree?.()
    else if (hit.kind === 'stash') onSelect?.(gitStashAsCommit(hit.stash))
    else if (commits[hit.index]) onSelect?.(commits[hit.index])
  }

  const onGraphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    // Dots handle their own click; still allow pan to start from empty graph area.
    if ((event.target as HTMLElement).closest('[data-git-graph-dot]')) return
    const node = graphScrollRef.current
    panRef.current = { x: event.clientX, y: event.clientY, left: node?.scrollLeft ?? 0, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onGraphPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panRef.current
    const node = graphScrollRef.current
    if (drag && node) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true
      if (drag.moved && node.scrollWidth > node.clientWidth) {
        node.scrollLeft = drag.left - (event.clientX - drag.x)
        syncGraphEdge()
        return
      }
    }
  }
  const onGraphPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panRef.current
    if (!drag) return
    const moved = drag.moved
    panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (moved) return
    selectCommitAtGraphY(event.clientY, event.currentTarget.getBoundingClientRect().top)
  }

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
      <ScrollArea className="min-h-0 min-w-0 flex-1" indicator="both" reserveGutter={false} scrollRef={scrollRef} scrollProps={{ 'aria-label': t('git.graph.historyAria') }}>
        <div className="relative min-w-0">
          <ol className="m-0 list-none">
            {scene.rows.map((row, rowIndex) => {
              const currDate = row.kind === 'commit' ? commits[row.index]?.date : row.kind === 'stash' ? row.stash.date : ''
              const prevRow = rowIndex > 0 ? scene.rows[rowIndex - 1] : undefined
              const prevDate = prevRow?.kind === 'commit' ? commits[prevRow.index]?.date : prevRow?.kind === 'stash' ? prevRow.stash.date : ''
              const isDateBoundary = Boolean(rowIndex > 0 && currDate && prevDate && toDateKey(currDate) !== toDateKey(prevDate))
              const dateDivider =
                isDateBoundary && currDate ? (
                  <div
                    className="pointer-events-none absolute -top-px right-0 z-20 flex h-0 items-center pr-3"
                    style={{ left: 'calc(var(--git-branch-w) + var(--git-graph-w))' }}
                    aria-hidden
                  >
                    <div className="h-px flex-1 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" />
                    <span className="ml-2 shrink-0 rounded border border-[color-mix(in_oklab,var(--ink)_12%,transparent)] bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-ink-soft select-none shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      {formatCommitDateDivider(currDate, locale)}
                    </span>
                  </div>
                ) : null

              if (row.kind === 'worktree' && worktree) {
                const isContextActive = contextMenu?.type === 'worktree'
                return (
                  <li key="worktree" className="relative z-0 h-[26px] max-h-[26px] shrink-0 overflow-visible">
                    {dateDivider}
                    <div
                      role="row"
                      tabIndex={0}
                      aria-selected={selectedHash === GIT_WORKTREE_HASH}
                      className="group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
                      style={{ gridTemplateColumns: columns }}
                      onClick={() => {
                        const sel = window.getSelection()
                        if (sel && sel.toString().length > 0) return
                        onSelectWorktree?.()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelectWorktree?.()
                        }
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setContextMenu({
                          type: 'worktree',
                          worktree,
                          color: laneColor(headIndex >= 0 ? (points[headIndex]?.color ?? 0) : 0),
                          anchor: { x: event.clientX, y: event.clientY },
                        })
                      }}
                    >
                      <span className="min-h-0 bg-transparent" />
                      <span className="flex h-[26px] min-h-0 items-center justify-end bg-transparent">
                        <span className="w-0.5 shrink-0" style={{ height: DOT, background: laneColor(headIndex >= 0 ? (points[headIndex]?.color ?? 0) : 0) }} aria-hidden />
                      </span>
                      <span className="flex h-[26px] min-h-0 min-w-0 items-center">
                        <span
                          className={cn(
                            'flex min-w-0 flex-1 items-center truncate pr-3 pl-2 text-sm leading-none font-normal text-ink-soft select-text cursor-pointer',
                            selectedHash === GIT_WORKTREE_HASH
                              ? 'bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]'
                              : isContextActive
                                ? 'bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]'
                                : 'group-hover/commit:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]'
                          )}
                          style={{ height: DOT }}
                        >
                          {t('git.graph.workingTree')}
                          {worktree.insertions || worktree.deletions ? (
                            <>
                              <span className="ml-3 text-ok">+{worktree.insertions}</span>
                              <span className="ml-2 text-fail">-{worktree.deletions}</span>
                            </>
                          ) : (
                            <span className="ml-3">{t('git.graph.filesCount', { count: worktree.files })}</span>
                          )}
                        </span>
                      </span>
                    </div>
                  </li>
                )
              }
              if (row.kind === 'stash') {
                const stash = row.stash
                const stashPoint = scene.stashPoints.get(stash.hash)
                const color = stashPoint ? laneColor(stashPoint.color) : 'var(--accent)'
                const selected = selectedHash === stash.hash
                const marked = highlight === stash.name
                const findHit = stashFindHit(stash, findNeedle)
                const isContextActive = contextMenu?.type === 'stash' && contextMenu.stash.hash === stash.hash
                const rowTintClass = cn(
                  selected
                    ? 'bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]'
                    : isContextActive
                      ? 'bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]'
                      : marked
                        ? 'bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]'
                        : ''
                )
                return (
                  <li key={stash.name} className="group/commit relative z-0 h-[26px] max-h-[26px] min-w-0 shrink-0 overflow-visible hover:z-10">
                    {/* Stash node to message hover highlight pill */}
                    <div
                      className="pointer-events-none absolute inset-y-0.5 z-0 rounded-l-full rounded-r-md transition-opacity duration-150 opacity-0 group-hover/commit:opacity-100 bg-[color-mix(in_oklab,var(--accent)_12%,var(--overlay-06))]"
                      style={{
                        left: `calc(var(--git-branch-w) + ${xAt(stashPoint?.lane ?? 0) - 10}px)`,
                        right: '0.5rem',
                      }}
                    />
                    {dateDivider}
                    <div
                      role="row"
                      tabIndex={0}
                      aria-selected={selected}
                      data-git-commit-hash={stash.hash}
                      className={cn(
                        'group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
                        findNeedle && !findHit && 'opacity-35'
                      )}
                      style={{ gridTemplateColumns: columns }}
                      onClick={() => {
                        const sel = window.getSelection()
                        if (sel && sel.toString().length > 0) return
                        onSelect?.(gitStashAsCommit(stash))
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelect?.(gitStashAsCommit(stash))
                        }
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setContextMenu({
                          type: 'stash',
                          stash,
                          color,
                          anchor: { x: event.clientX, y: event.clientY },
                        })
                      }}
                    >
                      <span data-git-branch-cell className="h-[26px] min-h-0 bg-transparent" />
                      <span className="flex h-[26px] min-h-0 items-center justify-end bg-transparent">
                        <span className="w-0.5 shrink-0" style={{ height: DOT, background: color }} aria-hidden />
                      </span>
                      <span className="flex h-[26px] min-h-0 min-w-0 items-center">
                        <span
                          className={cn('flex min-w-0 flex-1 items-center truncate pr-3 pl-2 text-sm leading-none font-normal text-ink select-text cursor-pointer', rowTintClass)}
                          style={{ height: DOT }}
                          title={stash.date ? `${stash.subject || stash.name} (${stash.date})` : stash.subject || stash.name}
                        >
                          {stash.subject || stash.name}
                        </span>
                      </span>
                    </div>
                  </li>
                )
              }
              if (row.kind !== 'commit') return null
              const index = row.index
              const commit = commits[index]
              if (!commit) return null
              const marked = highlight ? commit.refs.some((ref) => refHit(ref, highlight)) : false
              const selected = selectedHash === commit.hash
              const findHit = commitFindHit(commit, findNeedle)
              const chips = refChips(commit.refs, remoteNames)
              const point = points[index]
              const color = point ? laneColor(point.color) : 'var(--accent)'
              const branch = branchAt.get(commit.hash) || ''
              const isLineageActive = Boolean(lineageHashes && lineageHashes.size > 0)
              const isLineageHit = isLineageActive && lineageHashes!.has(commit.hash)
              const isContextActive = contextMenu?.type === 'commit' && contextMenu.commit.hash === commit.hash
              const spotlightTarget = spotlightMap?.get(commit.hash.toLowerCase())
              const isSpotlightHit = Boolean(spotlightTarget)
              const isSpotlightDimmed = isSpotlightActive && !isSpotlightHit
              const isBranchHit = Boolean(isBranchActive && branchHashes?.has(commit.hash))
              const isBranchDimmed = isBranchActive && !isBranchHit
              const rowTintClass = cn(
                isBranchHit
                  ? 'bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] ring-1 ring-inset ring-accent/60'
                  : isSpotlightHit && spotlightTarget?.role === 'primary'
                    ? 'bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] ring-1 ring-inset ring-accent/60'
                    : isSpotlightHit
                      ? 'bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] ring-1 ring-inset ring-blue-500/40'
                      : selected
                        ? 'bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]'
                        : isContextActive
                          ? 'bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]'
                          : isLineageHit
                            ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] ring-1 ring-inset ring-accent/35'
                            : marked
                              ? 'bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]'
                              : ''
              )
              const isHovered = isContextActive
              return (
                <li key={commit.hash} className="group/commit relative z-0 h-[26px] max-h-[26px] min-w-0 shrink-0 overflow-visible hover:z-10">
                  {/* Commit node to message hover highlight pill */}
                  <div
                    className="pointer-events-none absolute inset-y-0.5 z-0 rounded-l-full rounded-r-md transition-opacity duration-150 opacity-0 group-hover/commit:opacity-100 bg-[color-mix(in_oklab,var(--accent)_12%,var(--overlay-06))]"
                    style={{
                      left: `calc(var(--git-branch-w) + ${xAt(point?.lane ?? 0) - 10}px)`,
                      right: '0.5rem',
                    }}
                  />
                  {dateDivider}
                  <div
                    role="row"
                    tabIndex={0}
                    aria-selected={selected}
                    data-git-commit-hash={commit.hash}
                    className={cn(
                      'group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent transition-opacity duration-150',
                      findNeedle && !findHit && 'opacity-35',
                      isLineageActive && !isLineageHit && !selected && !isHovered && 'opacity-35 hover:opacity-100',
                      isSpotlightDimmed && !selected && !isHovered && 'opacity-35 hover:opacity-100',
                      isBranchDimmed && !selected && 'opacity-20'
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
                        commit,
                        branches: branchList,
                        color,
                        anchor: { x: event.clientX, y: event.clientY },
                      })
                    }}
                  >
                    <span data-git-branch-cell className="flex h-[26px] min-h-0 min-w-0 items-center justify-start overflow-hidden bg-transparent pl-0.5">
                      {chips.length > 0 ? (
                        <>
                          <RefChipsCell
                            chips={chips}
                            commit={commit}
                            checkedOut={checkedOut}
                            color={color}
                            onBranchHoverStart={handleBranchPointerEnter}
                            onBranchHoverEnd={handleBranchPointerLeave}
                            onSelectCommit={onSelect}
                          />
                          {spotlightTarget && <AnnotationBadge target={spotlightTarget} className="ml-1 shrink-0" />}
                          <span
                            className="h-0.5 min-w-2 flex-1"
                            style={{
                              background: `linear-gradient(to right, ${color}, color-mix(in oklab, ${color} 20%, transparent))`,
                              opacity: chips.some((chip) => chip.kind === 'head') ? 1 : 0.35,
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
                            style={{ height: BADGE_H, color, background: `color-mix(in oklab, ${color} 18%, transparent)` }}
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
                            className={cn('h-0.5 min-w-2 flex-1', isHovered ? 'inline-flex opacity-35' : 'hidden opacity-25 group-hover/commit:inline-flex')}
                            style={{
                              background: `linear-gradient(to right, ${color}, color-mix(in oklab, ${color} 20%, transparent))`,
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
                    <span className="flex h-[26px] min-h-0 items-center justify-end bg-transparent">
                      <span className="w-0.5 shrink-0" style={{ height: DOT, background: color }} aria-hidden />
                    </span>
                    <span className="flex h-[26px] min-h-0 min-w-0 items-center">
                      <span
                        className={cn(
                          'flex min-w-0 flex-1 items-center truncate pr-3 pl-2 text-sm leading-none font-normal select-text cursor-pointer transition-colors duration-150',
                          isBranchActive ? (isBranchHit ? 'text-ink font-semibold' : 'text-ink-soft/40') : 'text-ink',
                          rowTintClass
                        )}
                        style={{ height: DOT }}
                        title={commit.date ? `${commit.subject} (${commit.date})` : commit.subject}
                      >
                        {commit.subject}
                      </span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
          <div
            ref={graphScrollRef}
            data-git-graph-pan
            className="absolute top-0 left-[var(--git-branch-w)] z-[2] w-[var(--git-graph-w)] cursor-pointer overflow-x-auto overflow-y-hidden [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
            style={{ height: scene.height }}
            onScroll={syncGraphEdge}
            onPointerDown={onGraphPointerDown}
            onPointerMove={onGraphPointerMove}
            onPointerUp={onGraphPointerUp}
            onPointerCancel={onGraphPointerUp}
            onContextMenu={(event) => {
              event.preventDefault()
              const top = event.currentTarget.getBoundingClientRect().top
              const hit = scene.rows[Math.floor((event.clientY - top) / ROW)]
              if (!hit) return
              if (hit.kind === 'worktree' && worktree) {
                setContextMenu({
                  type: 'worktree',
                  worktree,
                  color: laneColor(headIndex >= 0 ? (points[headIndex]?.color ?? 0) : 0),
                  anchor: { x: event.clientX, y: event.clientY },
                })
              } else if (hit.kind === 'stash') {
                const stash = hit.stash
                const stashPoint = scene.stashPoints.get(stash.hash)
                const color = stashPoint ? laneColor(stashPoint.color) : 'var(--accent)'
                setContextMenu({
                  type: 'stash',
                  stash,
                  color,
                  anchor: { x: event.clientX, y: event.clientY },
                })
              } else if (hit.kind === 'commit') {
                const commit = commits[hit.index]
                if (!commit) return
                const point = points[hit.index]
                const color = point ? laneColor(point.color) : 'var(--accent)'
                const chips = refChips(commit.refs, remoteNames)
                const branch = branchAt.get(commit.hash) || ''
                const branchList = [...chips.map((c) => c.label), ...(branch ? [branch] : [])]
                setContextMenu({
                  type: 'commit',
                  commit,
                  branches: branchList,
                  color,
                  anchor: { x: event.clientX, y: event.clientY },
                })
              }
            }}
          >
            <div className="relative" style={{ width: contentWidth, height: scene.height }}>
              <svg className="pointer-events-none absolute inset-0 overflow-visible" width={contentWidth} height={scene.height} aria-hidden>
                <defs>
                  <style>{`
                    @keyframes wt-head-breathe {
                      0%, 100% {
                        box-shadow: inset 0 0 0 1.5px var(--wt-primary, #3cd2a8), 0 0 0 1px var(--panel), 0 0 3px var(--wt-primary-glow, #b8ffea);
                      }
                      50% {
                        box-shadow: inset 0 0 0 2px var(--wt-primary, #3cd2a8), 0 0 0 1px var(--panel), 0 0 4.5px var(--wt-primary-glow, #b8ffea);
                      }
                    }
                  `}</style>
                  {scene.strokes
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
                  {commits.map((commit, index) => {
                    const chips = refChips(commit.refs, remoteNames)
                    if (chips.length === 0) return null
                    const point = points[index]
                    if (!point) return null
                    const y = scene.commitRow[index] * ROW + ROW / 2
                    const isMerge = commit.parents.length > 1
                    const x = xAt(point.lane) - (isMerge ? MERGE_NODE_DOT : NODE_DOT) / 2
                    if (x <= 0) return null
                    const isHead = chips.some((chip) => chip.kind === 'head')
                    const color = laneColor(point.color)
                    return (
                      <linearGradient key={`lead-grad-${commit.hash}`} id={`wt-lead-${commit.hash}`} gradientUnits="userSpaceOnUse" x1={0} y1={y} x2={x} y2={y}>
                        <stop offset="0%" stopColor={color} stopOpacity={isHead ? 0.35 : 0.08} />
                        <stop offset="100%" stopColor={color} stopOpacity={isHead ? 1 : 0.65} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <GraphStrokes strokes={scene.strokes} lineageHashes={lineageHashes} spotlightHashes={spotlightHashes} branchHashes={branchHashes} />
                {commits.map((commit, index) => {
                  const chips = refChips(commit.refs, remoteNames)
                  const branch = branchAt.get(commit.hash) || ''
                  const point = points[index]
                  if (!point) return null
                  const isContextActive = contextMenu?.type === 'commit' && contextMenu.commit.hash === commit.hash
                  const isHovered = isContextActive
                  if (chips.length === 0 && (!branch || !isHovered)) return null
                  const y = scene.commitRow[index] * ROW + ROW / 2
                  const isMerge = commit.parents.length > 1
                  const x = xAt(point.lane) - (isMerge ? MERGE_NODE_DOT : NODE_DOT) / 2
                  if (x <= 0) return null
                  const isHead = chips.some((chip) => chip.kind === 'head')
                  const color = laneColor(point.color)
                  return (
                    <line
                      key={`badge:${commit.hash}`}
                      x1={0}
                      y1={y}
                      x2={x}
                      y2={y}
                      stroke={chips.length > 0 ? `url(#wt-lead-${commit.hash})` : color}
                      strokeWidth={isHead ? 2 : 1.5}
                      strokeDasharray={isHead ? undefined : '2 3'}
                      strokeOpacity={chips.length > 0 ? 1 : 0.65}
                      strokeLinecap="round"
                    />
                  )
                })}
                {scene.dots
                  .filter((dot) => dot.key === 'wip')
                  .map((dot) => (
                    <circle key={dot.key} cx={dot.x} cy={dot.y} r={dot.radius} fill={dot.filled ? dot.color : 'var(--panel)'} stroke={dot.color} strokeWidth={2} />
                  ))}
              </svg>
              {scene.stashMarks.map((mark) => {
                const stash = stashes.find((item) => item.hash === mark.hash)
                if (!stash) return null
                const tint = mark.color || 'var(--accent)'
                return (
                  <Tooltip key={mark.key} content={stash.name} placement="top">
                    <span
                      data-git-graph-dot
                      data-git-node-hash={stash.hash}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-dashed transition-all duration-200"
                      style={{
                        left: mark.x,
                        top: mark.y,
                        width: NODE_DOT,
                        height: NODE_DOT,
                        borderColor: tint,
                        color: tint,
                        background: `color-mix(in oklab, ${tint} 16%, var(--panel))`,
                        boxShadow: `0 0 3px color-mix(in oklab, ${tint} 25%, transparent)`,
                      }}
                      aria-label={stash.name}
                      onClick={() => onSelect?.(gitStashAsCommit(stash))}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setContextMenu({
                          type: 'stash',
                          stash,
                          color: tint,
                          anchor: { x: event.clientX, y: event.clientY },
                        })
                      }}
                    >
                      <LuInbox className="size-2.5" aria-hidden />
                    </span>
                  </Tooltip>
                )
              })}
              {commits.map((commit, index) => {
                const point = points[index]
                if (!point) return null
                const y = scene.commitRow[index] * ROW + ROW / 2
                const tint = laneColor(point.color)
                const isMerge = commit.parents.length > 1
                const isLineageHit = lineageHashes?.has(commit.hash)
                const isSpotlightHit = Boolean(spotlightMap?.get(commit.hash.toLowerCase()))
                const isSpotlightDimmed = isSpotlightActive && !isSpotlightHit
                const isBranchHit = Boolean(isBranchActive && branchHashes?.has(commit.hash))
                const isBranchDimmed = isBranchActive && !isBranchHit
                const isHead = index === headIndex || commit.refs.some((r) => r === 'HEAD' || r.startsWith('HEAD -> '))
                const isTagged = commit.refs.some((r) => r.startsWith('tag: '))
                const isDimmed = Boolean((lineageHashes && lineageHashes.size > 0 && !isLineageHit && !isHead) || isSpotlightDimmed || isBranchDimmed)
                return (
                  <Tooltip key={commit.hash} content={commit.author} placement="top">
                    <span
                      data-git-graph-dot
                      data-git-node-hash={commit.hash}
                      className={cn(
                        'absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full leading-none transition-all duration-200',
                        !isMerge && 'text-[9px] font-semibold text-ink',
                        isLineageHit && 'ring-2 ring-accent ring-offset-1 ring-offset-[var(--panel)] scale-110 z-10 shadow-[0_0_8px_var(--accent)]',
                        isSpotlightHit && 'ring-2 ring-accent ring-offset-1 ring-offset-[var(--panel)] scale-125 z-20 shadow-[0_0_12px_var(--accent)]',
                        isBranchHit && 'ring-2 ring-accent ring-offset-1 ring-offset-[var(--panel)] scale-125 z-20 shadow-[0_0_12px_var(--accent)]',
                        isBranchDimmed ? 'opacity-20' : isDimmed ? 'opacity-25 hover:opacity-100' : ''
                      )}
                      style={
                        isMerge
                          ? {
                              left: xAt(point.lane),
                              top: y,
                              width: MERGE_NODE_DOT,
                              height: MERGE_NODE_DOT,
                              background: 'var(--panel)',
                              border: `1.5px solid ${tint}`,
                              boxShadow: `0 0 3px color-mix(in oklab, ${tint} 30%, transparent)`,
                            }
                          : {
                              left: xAt(point.lane),
                              top: y,
                              width: NODE_DOT,
                              height: NODE_DOT,
                              background: `color-mix(in oklab, ${tint} 72%, var(--panel))`,
                              boxShadow: isHead
                                ? 'inset 0 0 0 1.5px var(--wt-primary, #3cd2a8), 0 0 0 1px var(--panel), 0 0 4px var(--wt-primary-glow, #b8ffea)'
                                : `inset 0 0 0 1.5px ${tint}`,
                              animation: isHead ? 'wt-head-breathe 2.8s ease-in-out infinite' : undefined,
                            }
                      }
                      aria-label={commit.author}
                      onClick={() => onSelect?.(commit)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        const chips = refChips(commit.refs, remoteNames)
                        const branch = branchAt.get(commit.hash) || ''
                        const branchList = [...chips.map((c) => c.label), ...(branch ? [branch] : [])]
                        setContextMenu({
                          type: 'commit',
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
                              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full border border-panel bg-[var(--wt-primary,#3cd2a8)] shadow-[0_0_3px_var(--wt-primary-glow,#b8ffea)]"
                              title="Tag"
                              aria-hidden
                            />
                          )}
                        </>
                      )}
                    </span>
                  </Tooltip>
                )
              })}
            </div>
          </div>
          {graphEdge.left ? (
            <div
              className="pointer-events-none absolute top-0 left-[var(--git-branch-w)] z-[3] h-full w-4 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--panel)_88%,transparent),transparent)]"
              style={{ height: scene.height }}
              aria-hidden
            />
          ) : null}
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
                  ? commitContextItems(contextMenu.commit, contextMenu.branches)
                  : contextMenu.type === 'stash'
                    ? stashContextItems(contextMenu.stash)
                    : worktreeContextItems(contextMenu.worktree)
              }
            />
          ) : null}
          {footer}
        </div>
      </ScrollArea>
    </div>
  )
}

export const GitGraph = memo(GitGraphComponent)
