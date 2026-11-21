'use client'

import { type CSSProperties, Fragment, memo, type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuCopy, LuHash, LuInbox, LuText, LuTriangleAlert } from 'react-icons/lu'

import { AnnotationBadge } from '@/components/git/agent/spotlight/AnnotationBadge'
import { CommitStatusBadge } from '@/components/git/CommitStatusBadge'
import { measureCellsFit } from '@/components/git/fitColumn'
import { PanelSplitter } from '@/components/git/PanelSplitter'
import { branchAtCommits, type FloatingAnchor, FloatingMenu, type FloatingMenuItem, refChips, RefChipsCell } from '@/components/git/RefChipsCell'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { EmptyState, ScrollArea } from '@/components/sk'
import { useOptionalAgent } from '@/lib/agent/agent-context'
import { useOptionalSpotlight } from '@/lib/agent/spotlight-context'
import { copyToClipboard } from '@/lib/clipboard'
import { buildBranchContextMenu } from '@/lib/git/branch-context-menu'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'
import { getGitDriver } from '@/lib/git/driver'
import { formatCommitAgo, formatCommitDateDivider } from '@/lib/git/format-commit-ago'
import { COL, DOT, graphScene, isHighlightedStroke, laneColor, PAD, ROW, type Stroke, xAt } from '@/lib/git/graph-scene'
import { getBranchCommitHashes } from '@/lib/git/topology'
import { GIT_WORKTREE_HASH, type GitCommit, type GitStash, gitStashAsCommit, type GitWorktree } from '@/lib/git/types'
import { isPositiveNumber, useGitUiPref, useGitUiReady } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

const BADGE_H = DOT
const NODE_DOT = 16
const MERGE_NODE_DOT = 8

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
  /** Rendered at the top of the scrollable list (e.g. infinite-scroll upward sentinel). */
  header?: ReactNode
  /** Rendered at the end of the scrollable list (e.g. infinite-scroll sentinel). */
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

function _refHit(ref: string, name: string): boolean {
  return ref === name || ref === `HEAD -> ${name}` || ref === `tag: ${name}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return [...parts[0]][0]?.toUpperCase() || '?'
  return `${[...parts[0]][0] || ''}${[...parts[1]][0] || ''}`.toUpperCase()
}

/** Memoized SVG linearGradient definitions layer to avoid DOM churn on hover / selection. */
const GraphDefs = memo(function GraphDefs({
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
            box-shadow: inset 0 0 0 1.5px var(--wt-primary, #3cd2a8), 0 0 0 1px var(--panel), 0 0 3px var(--wt-primary-glow, #b8ffea);
          }
          50% {
            box-shadow: inset 0 0 0 2px var(--wt-primary, #3cd2a8), 0 0 0 1px var(--panel), 0 0 4.5px var(--wt-primary-glow, #b8ffea);
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
}: Props) {
  const t = useT()
  const locale = useLocaleCode()
  const notify = useNotification()
  const [contextConfig] = useContextMenuConfig()
  const agent = useOptionalAgent()
  const spotlight = useOptionalSpotlight()
  const isSpotlightActive = Boolean(spotlight?.active && spotlight.targets.length > 0)
  const spotlightMap = spotlight?.targetsMap
  const [contextMenu, setContextMenu] = useState<GraphContextMenu | null>(null)
  const [hoveredHash, setHoveredHash] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<{
    commit: GitCommit
    x: number
    y: number
    color: string
    isMerge: boolean
    isConflictedMerge: boolean
  } | null>(null)
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

  const commitContextItems = (commit: GitCommit, branchNames?: string[] | string): FloatingMenuItem[] => {
    const rawList = Array.isArray(branchNames) ? branchNames : branchNames ? [branchNames] : []
    const branches = Array.from(new Set(rawList.filter(Boolean)))
    const primaryBranch = branches[0]

    return buildBranchContextMenu({
      branchName: primaryBranch,
      commit,
      repo,
      remoteUrl,
      remoteNames,
      isReadOnly: false,
      hasWorktrees: worktreeBranches.length > 0 || Boolean(worktree),
      soloBranch,
      onSoloBranch,
      config: contextConfig,
      onNotify: (type, msg) => {
        if (type === 'success') notify.success(msg)
        else notify.error(msg)
      },
      onCheckoutBranch: (branch, isRemote) => {
        if (onCheckoutBranch) {
          void onCheckoutBranch(branch, isRemote)
        } else if (agent) {
          agent.setDockMode('dock-right')
          void agent.sendMessage(`帮我跳转到 ${branch}`)
        }
      },
      onPushBranch,
      onPullBranch,
      onCreateBranch,
      onDeleteBranch,
      onRenameBranch,
      onAgentPrompt: (prompt) => {
        if (agent) {
          agent.setDockMode('dock-right')
          void agent.sendMessage(prompt)
        }
      },
      onUndoCommit:
        commit.hash === commits[0]?.hash
          ? async () => {
              if (!repo) return
              try {
                const driver = getGitDriver()
                const res = await driver.undo(repo)
                notify.success(res.message || t('git.operations.undoSuccess') || '已撤销上一次提交')
                await onRefresh?.()
              } catch (err) {
                notify.error(err instanceof Error ? err.message : t('git.operations.undoError') || '撤销失败')
              }
            }
          : undefined,
    })
  }

  const worktreeContextItems = (wt: GitWorktree): FloatingMenuItem[] => [
    {
      key: 'select-wt',
      label: t('git.graph.workingTree') || '查看工作区',
      icon: <LuCopy className="size-4 shrink-0 text-accent" />,
      onSelect: () => onSelectWorktree?.(),
    },
    {
      key: 'status',
      label: t('git.graph.copyWorktreeChanges'),
      icon: <LuCopy className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () =>
        void copyValue(
          wt.insertions || wt.deletions
            ? `${t('git.graph.workingTree')}: +${wt.insertions} -${wt.deletions} (${t('git.graph.filesCount', { count: wt.files })})`
            : `${t('git.graph.workingTree')}: ${t('git.graph.filesCount', { count: wt.files })}`
        ),
    },
  ]

  const stashContextItems = (stash: GitStash): FloatingMenuItem[] => [
    {
      key: 'subject',
      label: t('git.graph.copyStashSubject'),
      icon: <LuText className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () => void copyValue(stash.subject || stash.name),
      group: t('git.operations.groupCopy') || '复制',
    },
    {
      key: 'name',
      label: `${t('git.graph.copyStashName')} (${stash.name})`,
      icon: <LuCopy className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () => void copyValue(stash.name),
      group: t('git.operations.groupCopy') || '复制',
    },
    {
      key: 'base',
      label: t('git.graph.copyStashBase'),
      icon: <LuHash className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () => void copyValue(stash.base),
      group: t('git.operations.groupCopy') || '复制',
    },
  ]

  const scene = useMemo(() => graphScene(commits, worktree, stashes), [commits, worktree, stashes])
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
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const handleWheel = (e: WheelEvent) => {
      const hasHorizontalDelta = Math.abs(e.deltaX) > 0
      const isShiftWheel = e.shiftKey && Math.abs(e.deltaY) > 0
      const isAltWheel = e.altKey && Math.abs(e.deltaY) > 0

      // Let standard vertical scroll pass through immediately without any DOM layout queries
      if (!hasHorizontalDelta && !isShiftWheel && !isAltWheel) {
        return
      }

      const pan = graphScrollRef.current
      if (!pan) return
      const maxScroll = Math.max(0, pan.scrollWidth - pan.clientWidth)
      if (maxScroll <= 0) return

      const rect = frame.getBoundingClientRect()
      const isOverGraph = e.clientX >= rect.left + branchRef.current && e.clientX <= rect.left + branchRef.current + graphRef.current
      if (!isOverGraph) return

      // Ignore accidental trackpad horizontal jitter while scrolling vertically through commits
      if (hasHorizontalDelta && !isShiftWheel && !isAltWheel && Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) {
        return
      }

      const delta = hasHorizontalDelta ? e.deltaX : e.deltaY
      const prev = pan.scrollLeft
      pan.scrollLeft = Math.max(0, Math.min(maxScroll, pan.scrollLeft + delta))
      if (pan.scrollLeft !== prev) {
        e.preventDefault()
        syncGraphEdge()
      }
    }

    let dragStartX = 0
    let dragStartScroll = 0
    let isDragging = false
    let pointerCaptured = false
    let cleanupDrag: (() => void) | undefined
    let cleanupClick: (() => void) | undefined

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return
      const pan = graphScrollRef.current
      if (!pan) return
      const maxScroll = Math.max(0, pan.scrollWidth - pan.clientWidth)
      if (maxScroll <= 0) return

      const rect = frame.getBoundingClientRect()
      const isOverGraph = e.clientX >= rect.left + branchRef.current && e.clientX <= rect.left + branchRef.current + graphRef.current
      if (!isOverGraph) return

      const target = e.target as HTMLElement | null
      if (target?.closest('button') || target?.closest('[role="button"]') || target?.closest('a') || target?.closest('[data-split-handle]')) {
        return
      }

      cleanupDrag?.()
      cleanupClick?.()
      dragStartX = e.clientX
      dragStartScroll = pan.scrollLeft
      isDragging = false
      pointerCaptured = true

      const handlePointerMove = (moveEvt: PointerEvent) => {
        if (!pointerCaptured) return
        const dx = moveEvt.clientX - dragStartX
        if (!isDragging && Math.abs(dx) > 3) {
          isDragging = true
          frame.style.userSelect = 'none'
          frame.style.cursor = 'grabbing'
        }
        if (isDragging) {
          pan.scrollLeft = Math.max(0, Math.min(maxScroll, dragStartScroll - dx))
          syncGraphEdge()
        }
      }

      const handlePointerUp = (upEvt: PointerEvent) => {
        const suppressClick = isDragging && upEvt.type === 'pointerup'
        cleanupDrag?.()
        if (suppressClick) {
          upEvt.stopPropagation()
          const captureClick = (clickEvt: MouseEvent) => {
            clickEvt.stopPropagation()
            clickEvt.preventDefault()
            cleanupClick?.()
          }
          const timer = window.setTimeout(() => cleanupClick?.(), 0)
          cleanupClick = () => {
            window.clearTimeout(timer)
            window.removeEventListener('click', captureClick, true)
            cleanupClick = undefined
          }
          window.addEventListener('click', captureClick, true)
        }
      }

      cleanupDrag = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('pointercancel', handlePointerUp)
        frame.style.userSelect = ''
        frame.style.cursor = ''
        pointerCaptured = false
        isDragging = false
        cleanupDrag = undefined
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    }

    frame.addEventListener('wheel', handleWheel, { passive: false })
    frame.addEventListener('pointerdown', handlePointerDown)

    return () => {
      frame.removeEventListener('wheel', handleWheel)
      frame.removeEventListener('pointerdown', handlePointerDown)
      cleanupDrag?.()
      cleanupClick?.()
    }
  }, [contentWidth, syncGraphEdge])

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
        <div className="relative min-w-0 pb-12">
          {header}
          {/* Date boundary dividers rendered precisely on the seam between rows (rowIndex - 1 and rowIndex) */}
          <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden>
            {dateBoundaries.map((b) => (
              <div
                key={`date-boundary-${b.rowIndex}`}
                className="absolute right-0 flex h-0 items-center pr-3"
                style={{
                  top: b.rowIndex * ROW,
                  left: 'calc(var(--git-branch-w) + var(--git-graph-w))',
                }}
              >
                <div className="h-px flex-1 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" />
                <span className="ml-2 shrink-0 rounded border border-[color-mix(in_oklab,var(--ink)_12%,transparent)] bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-ink-soft select-none shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  {formatCommitDateDivider(b.date, locale)}
                </span>
              </div>
            ))}
          </div>
          <ol className="m-0 list-none">
            {scene.rows.map((row) => {
              if (row.kind === 'worktree' && worktree) {
                const isContextActive = contextMenu?.type === 'worktree'
                const wipDot = scene.dots.find((dot) => dot.key === 'wip')
                const color = wipDot?.color || laneColor(headIndex >= 0 ? (points[headIndex]?.color ?? 0) : 0)
                const isSelected = selectedHash === GIT_WORKTREE_HASH
                const nodeRadius = wipDot ? (isSelected ? wipDot.radius + 2.5 : wipDot.radius + 1) : 8
                const nodeX = wipDot ? wipDot.x : 16
                return (
                  <li key="worktree" className="group/commit git-commit-row relative z-0 h-[26px] max-h-[26px] min-w-0 shrink-0 overflow-visible hover:z-10">
                    {/* Seamless dual highlight pills across graph and message columns */}
                    <div
                      className="git-graph-col-pill"
                      data-selected={isSelected ? 'true' : 'false'}
                      style={{ '--row-tint': color, '--node-x': `${nodeX}px`, '--node-radius': `${nodeRadius}px` } as React.CSSProperties}
                    />
                    <div className="git-message-col-pill" data-selected={isSelected ? 'true' : 'false'} style={{ '--row-tint': color } as React.CSSProperties} />
                    <div
                      role="row"
                      tabIndex={0}
                      aria-selected={isSelected}
                      data-git-commit-hash={GIT_WORKTREE_HASH}
                      className="group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus:outline-none focus-visible:outline-none"
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
                          color,
                          anchor: { x: event.clientX, y: event.clientY },
                        })
                      }}
                    >
                      <span className="min-h-0 bg-transparent" />
                      <span className="flex h-[26px] min-h-0 items-center justify-end bg-transparent">
                        <span className="w-0.5 shrink-0" style={{ height: DOT, background: color }} aria-hidden />
                      </span>
                      <span className="flex h-[26px] min-h-0 min-w-0 items-center">
                        <span
                          className={cn(
                            'flex min-w-0 flex-1 items-center truncate pr-3 pl-2 text-sm leading-none font-normal select-text cursor-pointer transition-colors duration-150',
                            isSelected ? 'text-ink' : isContextActive ? 'text-ink' : 'text-ink-soft'
                          )}
                          style={{ height: DOT }}
                          title={`${t('git.graph.workingTree')} · ${t('git.graph.filesCount', { count: worktree.files })}`}
                        >
                          {t('git.graph.workingTree')}
                          {(() => {
                            const added = worktree.addedFiles !== undefined ? worktree.addedFiles : worktree.insertions
                            const deleted = worktree.deletedFiles !== undefined ? worktree.deletedFiles : worktree.deletions
                            if (added > 0 || deleted > 0) {
                              return (
                                <>
                                  {added > 0 ? <span className="ml-3 text-ok">+{added}</span> : null}
                                  {deleted > 0 ? <span className="ml-2 text-fail">-{deleted}</span> : null}
                                </>
                              )
                            }
                            return <span className="ml-3 text-ink-soft">{t('git.graph.filesCount', { count: worktree.files })}</span>
                          })()}
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
                const findHit = stashFindHit(stash, findNeedle)
                const isContextActive = contextMenu?.type === 'stash' && contextMenu.stash.hash === stash.hash
                const rowTintClass = cn(isContextActive ? 'bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]' : '')
                const nodeRadius = selected ? 12.5 : 8
                const nodeX = xAt(stashPoint?.lane ?? 0)
                return (
                  <li key={stash.name} className="group/commit git-commit-row relative z-0 h-[26px] max-h-[26px] min-w-0 shrink-0 overflow-visible hover:z-10">
                    {/* Seamless dual highlight pills across graph and message columns */}
                    <div
                      className="git-graph-col-pill"
                      data-selected={selected ? 'true' : 'false'}
                      style={{ '--row-tint': color, '--node-x': `${nodeX}px`, '--node-radius': `${nodeRadius}px` } as React.CSSProperties}
                    />
                    <div className="git-message-col-pill" data-selected={selected ? 'true' : 'false'} style={{ '--row-tint': color } as React.CSSProperties} />
                    <div
                      role="row"
                      tabIndex={0}
                      aria-selected={selected}
                      data-git-commit-hash={stash.hash}
                      className={cn(
                        'group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus:outline-none focus-visible:outline-none',
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
              const minNodeX = (isMerge ? MERGE_NODE_DOT : NODE_DOT) / 2 + 8
              const nodeX = Math.max(minNodeX + (graphEdge.scrollLeft || 0), xAt(point?.lane ?? 0))
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
                    <span className="flex h-[26px] min-h-0 items-center justify-end bg-transparent">
                      <span className="w-0.5 shrink-0" style={{ height: DOT, background: color }} aria-hidden />
                    </span>
                    <span data-git-message-cell className={cn('flex h-[26px] min-h-0 min-w-0 items-center pl-2', rowTintClass)}>
                      {isConflictedMerge && <CommitStatusBadge commit={commit} conflict={conflicts?.[commit.hash]} onOpenConflictView={onOpenConflictView} />}
                      <span
                        className="flex min-w-0 flex-1 items-center truncate pr-3 text-sm leading-none font-normal select-text cursor-pointer transition-colors duration-150 text-ink"
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
          <div
            ref={graphScrollRef}
            data-git-graph-pan
            className="pointer-events-none absolute top-0 left-[var(--git-branch-w)] z-[2] w-[var(--git-graph-w)] overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ height: scene.height + 24 }}
            onScroll={syncGraphEdge}
          >
            <div className="relative" style={{ width: contentWidth, height: scene.height + 24 }}>
              <svg className="pointer-events-none absolute inset-0 overflow-visible" width={contentWidth} height={scene.height + 24} aria-hidden>
                <GraphDefs strokes={scene.strokes} />
                <GraphStrokes strokes={scene.strokes} lineageHashes={lineageHashes} spotlightHashes={spotlightHashes} />
                {commits.map((commit, index) => {
                  const chips = refChips(commit.refs, remoteNames)
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
                  const minNodeX = nodeRadius + 8
                  const scrollLeft = graphEdge.scrollLeft || 0
                  const nodeX = Math.max(minNodeX + scrollLeft, xAt(point.lane))
                  const x1 = scrollLeft
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
                const stash = stashes.find((item) => item.hash === mark.hash)
                if (!stash) return null
                const tint = mark.color || 'var(--accent)'
                const isSelected = selectedHash === stash.hash
                const markX = Math.max(NODE_DOT / 2 + 8 + (graphEdge.scrollLeft || 0), mark.x)
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
                const isDimmed = Boolean((lineageHashes && lineageHashes.size > 0 && !isLineageHit && !isHead) || isSpotlightDimmed || isHoverBranchDimmed)
                const isSelected = selectedHash === commit.hash
                const chips = refChips(commit.refs, remoteNames)
                const branch = branchAt.get(commit.hash) || ''
                const nodeRadius = (isMerge ? MERGE_NODE_DOT : NODE_DOT) / 2
                const minNodeX = nodeRadius + 8
                const nodeX = Math.max(minNodeX + (graphEdge.scrollLeft || 0), xAt(point.lane))
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
                            border: isConflictedMerge ? '1.5px solid var(--warn, #f59e0b)' : `1.5px solid ${tint}`,
                            boxShadow: isConflictedMerge
                              ? isSelected
                                ? '0 0 0 2px var(--panel), 0 0 0 4px var(--warn, #f59e0b), 0 0 10px var(--warn, #f59e0b)'
                                : '0 0 0 1px var(--panel), 0 0 6px var(--warn, #f59e0b)'
                              : isSelected
                                ? `0 0 0 2px var(--panel), 0 0 0 4px ${tint}, 0 0 10px ${tint}`
                                : `0 0 3px color-mix(in oklab, ${tint} 30%, transparent)`,
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
                                ? 'inset 0 0 0 1.5px var(--wt-primary, #3cd2a8), 0 0 0 1px var(--panel), 0 0 4px var(--wt-primary-glow, #b8ffea)'
                                : `inset 0 0 0 1.5px ${tint}`,
                            animation: isHead && !isSelected ? 'wt-head-breathe 2.8s ease-in-out infinite' : undefined,
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
                        commit,
                        branches: branchList,
                        color: tint,
                        anchor: { x: event.clientX, y: event.clientY },
                      })
                    }}
                  >
                    {isMerge ? (
                      isConflictedMerge ? (
                        <LuTriangleAlert className="size-2 text-warn shrink-0" aria-label="Merge conflict" />
                      ) : (
                        <span className="size-1 rounded-full shrink-0" style={{ background: 'var(--wt-git-merge, var(--wt-merge, #d946ef))' }} aria-hidden />
                      )
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
                )
              })}
              {hoveredNode && (
                <div
                  className="pointer-events-none absolute z-50 animate-in fade-in-50 zoom-in-95 duration-150"
                  style={{
                    left: Math.max(145, Math.min(hoveredNode.x, contentWidth - 145)),
                    top: hoveredNode.y < 95 ? hoveredNode.y + 14 : hoveredNode.y - 10,
                    transform: hoveredNode.y < 95 ? 'translateX(-50%)' : 'translate(-50%, -100%)',
                  }}
                >
                  <div className="flex flex-col gap-1 w-72 rounded-lg border border-line bg-panel/95 p-2.5 shadow-xl text-left select-none backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-accent">{hoveredNode.commit.short || hoveredNode.commit.hash.slice(0, 7)}</span>
                      <span className="text-[11px] text-ink-soft">{formatCommitAgo(hoveredNode.commit.date, locale)}</span>
                    </div>
                    <p className="text-xs font-medium text-ink leading-snug line-clamp-2">{hoveredNode.commit.subject}</p>
                    <div className="flex items-center justify-between gap-2 border-t border-line/50 pt-1.5 mt-0.5 text-[11px] text-ink-soft font-sans">
                      <span className="font-medium text-ink truncate">{hoveredNode.commit.author}</span>
                      <span className="text-[10px] text-ink-soft/80 shrink-0">{hoveredNode.commit.date}</span>
                    </div>
                    {hoveredNode.isConflictedMerge && (
                      <div className="flex items-center gap-1.5 text-[11px] text-warn pt-0.5">
                        <LuTriangleAlert className="size-3.5 shrink-0" />
                        <span>
                          {t(conflicts?.[hoveredNode.commit.hash]?.unresolvedConflictFiles?.length ? 'git.history.committedConflicts' : 'git.history.historicalConflicts', {
                            count: conflicts?.[hoveredNode.commit.hash]?.unresolvedConflictFiles?.length || conflicts?.[hoveredNode.commit.hash]?.conflictCount || 1,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

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
