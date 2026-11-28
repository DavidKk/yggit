import { type GraphLink, layoutCommitGraph } from '@/lib/git/graph'
import { GIT_WORKTREE_HASH, type GitCommit, type GitStash, type GitWorktree } from '@/lib/git/types'

export const ROW = 26
export const COL = 22
export const PAD = 12
export const DOT = 22
export const MERGE_DOT = 12

export const LANE_COLOR = [
  'var(--wt-primary, var(--accent, #12a884))',
  'var(--wt-secondary, #0284c7)',
  '#9333ea',
  '#ea580c',
  '#2563eb',
  '#65a30d',
  'var(--wt-git-merge, var(--wt-merge, #c026d3))',
  '#d97706',
  '#0891b2',
  'var(--fail, #db2777)',
  '#4f46e5',
  '#16a34a',
  '#e11d48',
  'var(--wt-git-modified, var(--wt-modified, #ca8a04))',
  '#7c3aed',
  '#0d9488',
] as const

export function laneColor(index: number): string {
  const normalized = Math.max(0, Math.floor(index))
  if (normalized < LANE_COLOR.length) {
    return LANE_COLOR[normalized]
  }
  // Deterministic golden-angle spread beyond the 16 curated slots so colors remain consistent without wrapping onto index 0.
  const offset = normalized - LANE_COLOR.length + 1
  const hue = Math.round((offset * 137.508 + 29) % 360)
  return `hsl(${hue}, 74%, 46%)`
}

function commitIndexForBase(commits: GitCommit[], base: string): number {
  if (!base) return -1
  const exact = commits.findIndex((commit) => commit.hash === base)
  if (exact >= 0) return exact
  return commits.findIndex((commit) => commit.hash.startsWith(base) || base.startsWith(commit.hash))
}

export type GraphRow = { kind: 'worktree' } | { kind: 'stash'; stash: GitStash; baseIndex: number } | { kind: 'commit'; index: number }

/** Keep Git's commit order; insert stashes by creation date, always above their base. */
export function buildGraphRows(commits: GitCommit[], stashes: GitStash[], worktree: GitWorktree | null): GraphRow[] {
  const dates = commits.map((commit) => Date.parse(commit.date))
  const oldest = Math.min(...dates.filter(Number.isFinite))
  const grouped = new Map<number, Array<Extract<GraphRow, { kind: 'stash' }>>>()
  const seen = new Set(commits.map((commit) => commit.hash))
  for (const stash of [...stashes].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))) {
    if (seen.has(stash.hash)) continue
    seen.add(stash.hash)
    const baseIndex = commitIndexForBase(commits, stash.base)
    const date = Date.parse(stash.date)
    // Older stashes arrive as history is paged in. Recent ones stay visible even if the base is outside the scope/page.
    if (baseIndex < 0 && commits.length && !(date >= oldest)) continue
    let insertAt = dates.findIndex((commitDate) => commitDate <= date)
    if (insertAt < 0) insertAt = commits.length
    if (baseIndex >= 0) insertAt = Math.min(insertAt, baseIndex)
    const group = grouped.get(insertAt) ?? []
    group.push({ kind: 'stash', stash, baseIndex })
    grouped.set(insertAt, group)
  }
  const rows: GraphRow[] = worktree ? [{ kind: 'worktree' }] : []
  for (let index = 0; index <= commits.length; index++) {
    rows.push(...(grouped.get(index) ?? []))
    if (index < commits.length) rows.push({ kind: 'commit', index })
  }
  return rows
}

export function xAt(lane: number): number {
  return PAD + lane * COL + COL / 2
}

function laneCountOf(links: GraphLink[], lane: number): number {
  return Math.max(lane, ...links.map((link) => Math.max(link.from, link.to)), 0) + 1
}

export type Stroke = {
  key: string
  d: string
  color: number
  startColor?: number
  targetColor?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  dashed?: boolean
  bridge?: boolean
  hash: string
  childHash?: string
  parentHash?: string
  fromLane: number
  toLane: number
}
/** Rails retain their actual edge across unrelated rows. */
export function isHighlightedStroke(stroke: Stroke, hashes?: Set<string> | null): boolean {
  return Boolean(stroke.childHash && stroke.parentHash && hashes?.has(stroke.childHash) && hashes.has(stroke.parentHash))
}

type Dot = { key: string; x: number; y: number; color: string; filled: boolean; radius: number }
type StashMark = { key: string; hash: string; x: number; y: number; color: string }
export type GapRail = { lane: number; color: number; dashed?: boolean }

export function graphScene(commits: GitCommit[], worktree: GitWorktree | null, stashes: GitStash[], options?: { continuesAbove?: boolean; continuesBelow?: boolean }) {
  const continuesAbove = Boolean(options?.continuesAbove)
  const continuesBelow = Boolean(options?.continuesBelow)
  const rows = buildGraphRows(commits, stashes, worktree)
  const headIndex = commits.findIndex((commit) => commit.refs.some((ref) => ref === 'HEAD' || ref.startsWith('HEAD -> ')))
  const nodes = rows.map((row) => {
    if (row.kind === 'commit') return commits[row.index]
    if (row.kind === 'worktree') return { hash: GIT_WORKTREE_HASH, parents: headIndex >= 0 ? [commits[headIndex].hash] : [] }
    const base = row.baseIndex >= 0 ? commits[row.baseIndex].hash : row.stash.base
    return { hash: row.stash.hash, parents: [], attachment: base || `missing:${row.stash.hash}` }
  })
  const rowPoints = layoutCommitGraph(nodes)
  const commitRow: number[] = []
  const stashPoints = new Map<string, (typeof rowPoints)[number]>()
  const dashedColors = new Set<number>()
  rows.forEach((row, index) => {
    if (row.kind === 'commit') commitRow[row.index] = index
    if (row.kind === 'stash') {
      stashPoints.set(row.stash.hash, rowPoints[index])
    }
  })

  // Prioritize theme color (index 0) for the current HEAD branch, preserving discovery order for others.
  const headRowIndex = headIndex >= 0 ? commitRow[headIndex] : -1
  const headColor = headRowIndex >= 0 ? rowPoints[headRowIndex]?.color : undefined
  if (headColor !== undefined && headColor !== 0) {
    const normalizeColor = (c: number) => (c === headColor ? 0 : c < headColor ? c + 1 : c)
    for (const point of rowPoints) {
      point.color = normalizeColor(point.color)
      for (const link of point.links) {
        link.color = normalizeColor(link.color)
      }
      if (point.incoming) {
        for (const link of point.incoming) {
          link.color = normalizeColor(link.color)
        }
      }
    }
  }

  rows.forEach((row, index) => {
    if (row.kind === 'stash') {
      dashedColors.add(rowPoints[index].color)
    }
  })
  const points = commitRow.map((row) => rowPoints[row])
  const strokes: Stroke[] = []
  const dots: Dot[] = []
  const stashMarks: StashMark[] = []
  const bottomRailsMap = new Map<number, GapRail>()
  const topRails: GapRail[] = rowPoints[0] ? [{ lane: rowPoints[0].lane, color: rowPoints[0].color }] : []
  let rails = new Map<number, { childHash: string; parentHash: string }>()
  rows.forEach((row, index) => {
    const previousRails = rails
    rails = new Map()
    let parentIndex = 0
    const point = rowPoints[index]
    const isLastRow = index === rows.length - 1
    const yTop = index * ROW
    const yMid = yTop + ROW / 2
    const yBot = isLastRow && !continuesBelow ? yMid : yTop + ROW
    const hash = nodes[index].hash
    if (index === 0 && continuesAbove && !point.joins) {
      strokes.push({
        key: `${hash}:above-entry`,
        d: `M ${xAt(point.lane)} ${yTop} L ${xAt(point.lane)} ${yMid}`,
        color: point.color,
        startColor: point.color,
        targetColor: point.color,
        x1: xAt(point.lane),
        y1: yTop,
        x2: xAt(point.lane),
        y2: yMid,
        dashed: true,
        hash,
        fromLane: point.lane,
        toLane: point.lane,
      })
    }
    point.links.forEach((link, linkIndex) => {
      if (isLastRow && !bottomRailsMap.has(link.to)) {
        bottomRailsMap.set(link.to, {
          lane: link.to,
          color: link.color,
          dashed: dashedColors.has(link.color),
        })
      }
      if (isLastRow && !continuesBelow && link.from === point.lane) return
      const x1 = xAt(link.from)
      const x2 = xAt(link.to)
      const startY = link.from === point.lane ? yMid : yTop
      if (startY >= yBot) return
      const mid = (yMid + yBot) / 2
      const isCurve = link.from !== link.to
      const startColor = link.from === point.lane ? point.color : link.color
      const targetColor = link.color
      const edge = link.from === point.lane ? { childHash: hash, parentHash: nodes[index].parents[parentIndex++] ?? hash } : previousRails.get(link.from)
      if (edge) rails.set(link.to, edge)
      strokes.push({
        ...edge,
        key: `${hash}:${linkIndex}`,
        d: !isCurve ? `M ${x1} ${startY} L ${x2} ${yBot}` : `M ${x1} ${yMid} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${yBot}`,
        color: link.color,
        startColor,
        targetColor,
        x1,
        y1: isCurve ? yMid : startY,
        x2,
        y2: yBot,
        dashed: dashedColors.has(link.color),
        bridge: isCurve,
        hash,
        fromLane: link.from,
        toLane: link.to,
      })
    })
    point.incoming?.forEach((link, linkIndex) => {
      const x1 = xAt(link.from)
      const x2 = xAt(link.to)
      const mid = (yTop + yMid) / 2
      strokes.push({
        ...previousRails.get(link.from),
        key: `${hash}:attachment:${linkIndex}`,
        d: `M ${x1} ${yTop} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${yMid}`,
        color: link.color,
        startColor: link.color,
        targetColor: point.color,
        x1,
        y1: yTop,
        x2,
        y2: yMid,
        dashed: dashedColors.has(link.color),
        bridge: true,
        hash,
        fromLane: link.from,
        toLane: link.to,
      })
    })
    if (point.joins) {
      const incoming = rowPoints[index - 1]?.links.find((link) => link.to === point.lane)
      const color = incoming?.color ?? point.color
      strokes.push({
        ...previousRails.get(point.lane),
        key: `${hash}:stem`,
        d: `M ${xAt(point.lane)} ${yTop} L ${xAt(point.lane)} ${yMid}`,
        color,
        startColor: color,
        targetColor: color,
        x1: xAt(point.lane),
        y1: yTop,
        x2: xAt(point.lane),
        y2: yMid,
        hash,
        fromLane: point.lane,
        toLane: point.lane,
      })
    }
    if (row.kind === 'stash') {
      stashMarks.push({ key: hash, hash, x: xAt(point.lane), y: yMid, color: laneColor(point.color) })
    } else if (row.kind === 'worktree') {
      dots.push({ key: 'wip', x: xAt(point.lane), y: yMid, color: laneColor(point.color), filled: true, radius: 9 })
    }
  })
  const laneCount = Math.max(1, ...rowPoints.map((point) => laneCountOf([...point.links, ...(point.incoming ?? [])], point.lane)))
  // Draw bends above straight rails; a narrow background stroke makes crossings
  // readable without implying an extra parent/merge connection.
  strokes.sort((a, b) => Number(!!a.bridge) - Number(!!b.bridge))
  const bottomRails = Array.from(bottomRailsMap.values()).sort((a, b) => a.lane - b.lane)
  return { strokes, dots, stashMarks, rows, commitRow, points, stashPoints, headIndex, laneCount, height: rows.length * ROW, topRails, bottomRails }
}
