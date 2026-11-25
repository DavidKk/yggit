'use client'

import { useMemo, useState } from 'react'
import { LuPencil } from 'react-icons/lu'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'
import type { ThemedToken } from 'shiki'

import { GitCodePane } from '@/components/git/GitCodePane'
import type { GitFilePane } from '@/components/git/GitFilePreview'
import { GitDiffCodeText, useGitLineTokens } from '@/components/git/GitHighlightedCode'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import type { GitBlameLine } from '@/lib/git/driver/types'
import { formatCommitAgo } from '@/lib/git/format-commit-ago'
import { computeIntraDiff } from '@/lib/git/intra-diff'
import { cn } from '@/lib/utils'

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

export type Mode = 'file' | 'diff'
export type Viewport = 'group' | 'full' | 'split'

export function isMode(value: unknown): value is Mode {
  return value === 'file' || value === 'diff'
}

export function isViewport(value: unknown): value is Viewport {
  return value === 'group' || value === 'full' || value === 'split'
}

export function isPane(value: unknown): value is GitFilePane {
  return value === 'code' || value === 'preview'
}

export type DiffLine = { kind: 'add' | 'del' | 'context' | 'meta'; text: string; oldNo?: number; newNo?: number; beforeNew?: number }
export type AlignedRow = { kind: 'add' | 'del' | 'context'; text: string; oldNo?: number; newNo?: number }
export type Hunk = { header: string; lines: DiffLine[] }
export type ChangeCounts = { add: number; edit: number; del: number }

export function parseHunks(patch: string): Hunk[] {
  const hunks: Hunk[] = []
  let current: Hunk | null = null
  let oldNo = 0
  let newNo = 0
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('@@')) {
      const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
      oldNo = match ? Number(match[1]) : 0
      newNo = match ? Number(match[2]) : 0
      current = { header: raw, lines: [] }
      hunks.push(current)
      continue
    }
    if (!current || raw.startsWith('diff ') || raw.startsWith('index ') || raw.startsWith('---') || raw.startsWith('+++')) continue
    if (raw.startsWith('\\')) {
      current.lines.push({ kind: 'meta', text: raw })
      continue
    }
    if (raw.startsWith('+')) {
      current.lines.push({ kind: 'add', text: raw.slice(1), newNo })
      newNo += 1
      continue
    }
    if (raw.startsWith('-')) {
      current.lines.push({ kind: 'del', text: raw.slice(1), oldNo, beforeNew: newNo > 0 ? newNo : undefined })
      oldNo += 1
      continue
    }
    const text = raw.startsWith(' ') ? raw.slice(1) : raw
    current.lines.push({ kind: 'context', text, oldNo, newNo })
    oldNo += 1
    newNo += 1
  }
  return hunks
}

export function alignFile(content: string | undefined, missing: boolean, hunks: Hunk[]): AlignedRow[] {
  if (missing) {
    return hunks.flatMap((hunk) => hunk.lines.filter((line) => line.kind === 'del').map((line) => ({ kind: 'del' as const, text: line.text, oldNo: line.oldNo })))
  }
  const lines = (content || '').replace(/\n$/, '').split('\n')
  const added = new Set<number>()
  const deletedBefore = new Map<number, AlignedRow[]>()
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add' && line.newNo) added.add(line.newNo)
      if (line.kind === 'del') {
        const key = line.beforeNew && line.beforeNew > 0 ? line.beforeNew : lines.length + 1
        const list = deletedBefore.get(key) ?? []
        list.push({ kind: 'del', text: line.text, oldNo: line.oldNo })
        deletedBefore.set(key, list)
      }
    }
  }
  const rows: AlignedRow[] = []
  let oldCursor = 1
  const takeDeleted = (key: number) => {
    for (const row of deletedBefore.get(key) ?? []) {
      rows.push(row)
      oldCursor = (row.oldNo ?? oldCursor) + 1
    }
  }
  if (lines.length === 1 && lines[0] === '' && !added.size && !deletedBefore.size) return []
  lines.forEach((text, index) => {
    const newNo = index + 1
    takeDeleted(newNo)
    if (added.has(newNo)) rows.push({ kind: 'add', text, newNo })
    else {
      rows.push({ kind: 'context', text, oldNo: oldCursor, newNo })
      oldCursor += 1
    }
  })
  takeDeleted(lines.length + 1)
  return rows
}

export function countChanges(hunks: Hunk[]): ChangeCounts {
  let add = 0
  let del = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add') add += 1
      if (line.kind === 'del') del += 1
    }
  }
  const edit = Math.min(add, del)
  return { add: add - edit, edit, del: del - edit }
}

export function PlainRows({
  rows,
  path,
  activeIndex,
  searchNeedle,
  wordWrap,
  blameMap,
}: {
  rows: AlignedRow[]
  path: string
  activeIndex?: number
  searchNeedle?: string
  wordWrap?: boolean
  blameMap?: Record<number, GitBlameLine>
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const locale = useLocaleCode()

  // Compute intra-line diff ranges for paired consecutive deletions and additions
  const enrichedRows = useMemo(() => {
    const result: Array<AlignedRow & { diffRanges?: Array<[number, number]> }> = []
    let i = 0
    while (i < rows.length) {
      if (rows[i].kind === 'context') {
        result.push(rows[i])
        i++
        continue
      }
      const dels: AlignedRow[] = []
      const adds: AlignedRow[] = []
      while (i < rows.length && rows[i].kind === 'del') {
        dels.push(rows[i])
        i++
      }
      while (i < rows.length && rows[i].kind === 'add') {
        adds.push(rows[i])
        i++
      }
      const pairCount = Math.min(dels.length, adds.length)
      const delRangesMap = new Map<number, Array<[number, number]>>()
      const addRangesMap = new Map<number, Array<[number, number]>>()
      for (let k = 0; k < pairCount; k++) {
        const { oldRanges, newRanges } = computeIntraDiff(dels[k].text, adds[k].text)
        delRangesMap.set(k, oldRanges)
        addRangesMap.set(k, newRanges)
      }
      dels.forEach((del, idx) => result.push({ ...del, diffRanges: delRangesMap.get(idx) }))
      adds.forEach((add, idx) => result.push({ ...add, diffRanges: addRangesMap.get(idx) }))
    }
    return result
  }, [rows])

  const liveLines = useMemo(() => enrichedRows.filter((row) => row.kind !== 'del').map((row) => row.text), [enrichedRows])
  const delLines = useMemo(() => enrichedRows.filter((row) => row.kind === 'del').map((row) => row.text), [enrichedRows])
  const liveTokens = useGitLineTokens(liveLines, path)
  const delTokens = useGitLineTokens(delLines, path)
  let liveAt = 0
  let delAt = 0
  return (
    <div onMouseLeave={() => setHoveredIdx(null)} className={wordWrap ? 'min-w-0 w-full' : 'min-w-full w-max'}>
      {enrichedRows.map((row, index) => {
        const tokens = row.kind === 'del' ? delTokens?.[delAt++] : liveTokens?.[liveAt++]
        const isActive = activeIndex === index
        const isHovered = hoveredIdx === index
        const isMatch = Boolean(searchNeedle && row.text.toLowerCase().includes(searchNeedle.toLowerCase()))
        const lineNo = row.newNo ?? row.oldNo
        const blame = lineNo ? blameMap?.[lineNo] : undefined
        return (
          <div
            key={index}
            data-diff-line-idx={index}
            onMouseEnter={() => setHoveredIdx(index)}
            className={cn(
              'group/diffrow relative flex items-center transition-colors',
              wordWrap ? 'min-w-0 w-full' : 'min-w-full w-max',
              row.kind === 'add' && 'bg-[#ecfdf5]/85 text-[#064e3b] dark:bg-[#064e3b]/22 dark:text-ink border-l-2 border-emerald-500/70',
              row.kind === 'del' && 'bg-[#fff1f2]/85 text-[#881337] dark:bg-[#881337]/22 dark:text-ink border-l-2 border-rose-500/70',
              isActive && 'bg-accent/25 ring-1 ring-inset ring-accent',
              !isActive && isMatch && 'bg-accent/5',
              isHovered && !isActive && (row.kind ? 'brightness-95' : 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')
            )}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{row.newNo ?? row.oldNo ?? ''}</span>
            <GitDiffCodeText kind={row.kind} text={row.text} tokens={tokens} searchNeedle={searchNeedle} isActiveLine={isActive} wrap={wordWrap} diffRanges={row.diffRanges} />
            {blame && (
              <span
                className={cn(
                  'pl-6 pr-3 text-[11px] text-ink-soft/75 select-none font-sans shrink-0 max-w-[45%] pointer-events-none truncate italic transition-opacity duration-150',
                  isHovered ? 'opacity-100' : 'opacity-0 group-hover/diffrow:opacity-100'
                )}
                title={`${blame.author} (${blame.hash.slice(0, 7)}): ${blame.summary}`}
              >
                {blame.author}, {formatCommitAgo(blame.date, locale)} · {blame.summary}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function splitPairs(rows: AlignedRow[]): Array<{
  left?: AlignedRow & { diffRanges?: Array<[number, number]> }
  right?: AlignedRow & { diffRanges?: Array<[number, number]> }
}> {
  const pairs: Array<{
    left?: AlignedRow & { diffRanges?: Array<[number, number]> }
    right?: AlignedRow & { diffRanges?: Array<[number, number]> }
  }> = []

  let index = 0
  while (index < rows.length) {
    const row = rows[index]
    if (row.kind === 'context') {
      pairs.push({ left: row, right: row })
      index++
      continue
    }

    const dels: AlignedRow[] = []
    const adds: AlignedRow[] = []
    while (index < rows.length && rows[index].kind === 'del') {
      dels.push(rows[index])
      index++
    }
    while (index < rows.length && rows[index].kind === 'add') {
      adds.push(rows[index])
      index++
    }

    const maxLen = Math.max(dels.length, adds.length)
    for (let k = 0; k < maxLen; k++) {
      const del = dels[k]
      const add = adds[k]
      if (del && add) {
        const { oldRanges, newRanges } = computeIntraDiff(del.text, add.text)
        pairs.push({
          left: { ...del, diffRanges: oldRanges },
          right: { ...add, diffRanges: newRanges },
        })
      } else if (del) {
        pairs.push({ left: del })
      } else if (add) {
        pairs.push({ right: add })
      }
    }
  }

  return pairs
}

export function SplitRows({
  rows,
  path,
  activeIndex,
  targetSequence,
  wordWrap,
  beforeBlameMap,
  afterBlameMap,
}: {
  rows: AlignedRow[]
  path: string
  activeIndex?: number
  targetSequence: number
  wordWrap?: boolean
  beforeBlameMap?: Record<number, GitBlameLine>
  afterBlameMap?: Record<number, GitBlameLine>
}) {
  const t = useT()
  const pairs = useMemo(() => splitPairs(rows), [rows])
  const [scrollTop, setScrollTop] = useState(0)
  const target = activeIndex === undefined ? -1 : pairs.findIndex((pair) => pair.left === rows[activeIndex] || pair.right === rows[activeIndex])
  const left = useMemo(
    () =>
      pairs.map((pair) => ({
        text: pair.left?.text ?? '',
        number: pair.left?.oldNo,
        kind: pair.left?.kind,
        diffRanges: pair.left?.diffRanges,
      })),
    [pairs]
  )
  const right = useMemo(
    () =>
      pairs.map((pair) => ({
        text: pair.right?.text ?? '',
        number: pair.right?.newNo,
        kind: pair.right?.kind,
        diffRanges: pair.right?.diffRanges,
      })),
    [pairs]
  )
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 bg-paper p-2">
      <GitCodePane
        label={t('git.diff.before')}
        path={path}
        rows={left}
        scrollTop={scrollTop}
        onScroll={setScrollTop}
        targetLine={target < 0 ? undefined : target}
        targetSequence={targetSequence}
        wordWrap={wordWrap}
        blameMap={beforeBlameMap}
      />
      <GitCodePane
        label={t('git.diff.after')}
        path={path}
        rows={right}
        scrollTop={scrollTop}
        onScroll={setScrollTop}
        targetLine={target < 0 ? undefined : target}
        targetSequence={targetSequence}
        wordWrap={wordWrap}
        blameMap={afterBlameMap}
      />
    </div>
  )
}

export function HunkBlock({
  hunk,
  path,
  lineOffset = 0,
  activeIndex,
  searchNeedle,
  wordWrap,
  blameMap,
}: {
  hunk: Hunk
  path: string
  lineOffset?: number
  activeIndex?: number
  searchNeedle?: string
  wordWrap?: boolean
  blameMap?: Record<number, GitBlameLine>
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const locale = useLocaleCode()

  // Compute intra-diff for paired deletions and additions in hunk
  const enrichedLines = useMemo(() => {
    const result: Array<(typeof hunk.lines)[number] & { diffRanges?: Array<[number, number]> }> = []
    let i = 0
    while (i < hunk.lines.length) {
      if (hunk.lines[i].kind === 'context' || hunk.lines[i].kind === 'meta') {
        result.push(hunk.lines[i])
        i++
        continue
      }
      const dels: Array<(typeof hunk.lines)[number]> = []
      const adds: Array<(typeof hunk.lines)[number]> = []
      while (i < hunk.lines.length && hunk.lines[i].kind === 'del') {
        dels.push(hunk.lines[i])
        i++
      }
      while (i < hunk.lines.length && hunk.lines[i].kind === 'add') {
        adds.push(hunk.lines[i])
        i++
      }
      const pairCount = Math.min(dels.length, adds.length)
      const delRangesMap = new Map<number, Array<[number, number]>>()
      const addRangesMap = new Map<number, Array<[number, number]>>()
      for (let k = 0; k < pairCount; k++) {
        const { oldRanges, newRanges } = computeIntraDiff(dels[k].text, adds[k].text)
        delRangesMap.set(k, oldRanges)
        addRangesMap.set(k, newRanges)
      }
      dels.forEach((del, idx) => result.push({ ...del, diffRanges: delRangesMap.get(idx) }))
      adds.forEach((add, idx) => result.push({ ...add, diffRanges: addRangesMap.get(idx) }))
    }
    return result
  }, [hunk])

  const oldLines = useMemo(() => enrichedLines.filter((line) => line.kind === 'context' || line.kind === 'del').map((line) => line.text), [enrichedLines])
  const newLines = useMemo(() => enrichedLines.filter((line) => line.kind === 'context' || line.kind === 'add').map((line) => line.text), [enrichedLines])
  const oldTokens = useGitLineTokens(oldLines, path)
  const newTokens = useGitLineTokens(newLines, path)

  const renderedLines = useMemo(() => {
    let oldAt = 0
    let newAt = 0
    const result: Array<{ line: (typeof enrichedLines)[number]; tokens: ThemedToken[] | undefined }> = []
    for (const line of enrichedLines) {
      let tokens: ThemedToken[] | undefined
      if (line.kind === 'del') {
        tokens = oldTokens?.[oldAt]
        oldAt += 1
      } else if (line.kind === 'add') {
        tokens = newTokens?.[newAt]
        newAt += 1
      } else if (line.kind === 'context') {
        tokens = newTokens?.[newAt] ?? oldTokens?.[oldAt]
        oldAt += 1
        newAt += 1
      }
      result.push({ line, tokens })
    }
    return result
  }, [enrichedLines, oldTokens, newTokens])

  return (
    <div onMouseLeave={() => setHoveredIdx(null)} className={wordWrap ? 'min-w-0 w-full' : 'min-w-full w-max'}>
      <div className="border-b border-line bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] px-3 text-ink-soft">{hunk.header}</div>
      {renderedLines.map(({ line, tokens }, index) => {
        const lineIdx = lineOffset + index
        const isActive = activeIndex === lineIdx
        const isHovered = hoveredIdx === index
        const isMatch = Boolean(searchNeedle && line.text.toLowerCase().includes(searchNeedle.toLowerCase()))
        const lineNo = line.newNo ?? line.oldNo
        const blame = lineNo ? blameMap?.[lineNo] : undefined
        return (
          <div
            key={`${hunk.header}:${index}`}
            data-diff-line-idx={lineIdx}
            onMouseEnter={() => setHoveredIdx(index)}
            className={cn(
              'group/diffrow relative flex items-center transition-colors',
              wordWrap ? 'min-w-0 w-full' : 'min-w-full w-max',
              line.kind === 'add' && 'bg-[#ecfdf5]/85 text-[#064e3b] dark:bg-[#064e3b]/22 dark:text-ink border-l-2 border-emerald-500/70',
              line.kind === 'del' && 'bg-[#fff1f2]/85 text-[#881337] dark:bg-[#881337]/22 dark:text-ink border-l-2 border-rose-500/70',
              isActive && 'bg-accent/25 ring-1 ring-inset ring-accent',
              !isActive && isMatch && 'bg-accent/5',
              isHovered && !isActive && (line.kind ? 'brightness-95' : 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')
            )}
          >
            <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{line.oldNo ?? ''}</span>
            <span className="w-10 shrink-0 border-r border-line pr-2 text-right text-ink-soft select-none font-mono">{line.newNo ?? ''}</span>
            <GitDiffCodeText kind={line.kind} text={line.text} tokens={tokens} searchNeedle={searchNeedle} isActiveLine={isActive} wrap={wordWrap} diffRanges={line.diffRanges} />
            {blame && (
              <span
                className={cn(
                  'pl-6 pr-3 text-[11px] text-ink-soft/75 select-none font-sans shrink-0 max-w-[45%] pointer-events-none truncate italic transition-opacity duration-150',
                  isHovered ? 'opacity-100' : 'opacity-0 group-hover/diffrow:opacity-100'
                )}
                title={`${blame.author} (${blame.hash.slice(0, 7)}): ${blame.summary}`}
              >
                {blame.author}, {formatCommitAgo(blame.date, locale)} · {blame.summary}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function CountMarks({ counts }: { counts: ChangeCounts }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
      {counts.edit > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-warn">
          <LuPencil className="size-3" aria-hidden />
          {counts.edit}
        </span>
      ) : null}
      {counts.add > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-ok">
          <TiPlusOutline className="size-3" aria-hidden />
          {counts.add}
        </span>
      ) : null}
      {counts.del > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-fail">
          <TiMinusOutline className="size-3" aria-hidden />
          {counts.del}
        </span>
      ) : null}
    </span>
  )
}

type TFn = ReturnType<typeof useT>

export function fileStatus(status: string, t: TFn): { label: string; className: string; Icon: typeof TiPlusOutline } {
  if (status === 'A' || status === 'C') return { label: t('git.status.add'), className: 'text-ok', Icon: TiPlusOutline }
  if (status === 'D') return { label: t('git.status.delete'), className: 'text-fail', Icon: TiMinusOutline }
  return { label: status === 'R' ? t('git.status.rename') : t('git.status.modify'), className: 'text-warn', Icon: LuPencil }
}

export const rowsFor = (content: string | null) =>
  content === null
    ? []
    : content
        .replace(/\n$/, '')
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
