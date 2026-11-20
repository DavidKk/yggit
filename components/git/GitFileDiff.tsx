'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuAlignLeft,
  LuChevronDown,
  LuChevronUp,
  LuCodeXml,
  LuColumns2,
  LuEye,
  LuFileText,
  LuGitCompareArrows,
  LuGitMerge,
  LuListTree,
  LuPencil,
  LuRows3,
  LuSearch,
  LuWrapText,
  LuX,
} from 'react-icons/lu'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'
import type { ThemedToken } from 'shiki'

import { gitFileKind } from '@/components/git/fileKind'
import { GitCodePane } from '@/components/git/GitCodePane'
import { type GitFilePane, GitFilePreview } from '@/components/git/GitFilePreview'
import { GIT_FIND_EVENT, useGitFindPanel, useGitFindShortcutLabel } from '@/components/git/gitFind'
import { GitFindBox } from '@/components/git/GitFindBox'
import { GitDiffCodeText, useGitLineTokens } from '@/components/git/GitHighlightedCode'
import { useGitBlame } from '@/components/git/useGitBlame'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { Button, EmptyState, ScrollArea, SegmentedNav, Tooltip } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import type { GitBlameLine } from '@/lib/git/driver/types'
import { formatCommitAgo } from '@/lib/git/format-commit-ago'
import { computeIntraDiff } from '@/lib/git/intra-diff'
import type { GitCommitChanges } from '@/lib/git/types'
import { useGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

type Props = {
  repo: string
  hash: string
  path: string
  status?: string
  onClose: () => void
  onPrevFile?: () => void
  onNextFile?: () => void
  fileIndex?: number
  fileCount?: number
  hasConflict?: boolean
  onOpenConflictView?: () => void
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

type Mode = 'file' | 'diff'
type Viewport = 'group' | 'full' | 'split'

function isMode(value: unknown): value is Mode {
  return value === 'file' || value === 'diff'
}

function isViewport(value: unknown): value is Viewport {
  return value === 'group' || value === 'full' || value === 'split'
}

function isPane(value: unknown): value is GitFilePane {
  return value === 'code' || value === 'preview'
}

type DiffLine = { kind: 'add' | 'del' | 'context' | 'meta'; text: string; oldNo?: number; newNo?: number; beforeNew?: number }
type AlignedRow = { kind: 'add' | 'del' | 'context'; text: string; oldNo?: number; newNo?: number }
type Hunk = { header: string; lines: DiffLine[] }
type ChangeCounts = { add: number; edit: number; del: number }

function parseHunks(patch: string): Hunk[] {
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

function alignFile(content: string | undefined, missing: boolean, hunks: Hunk[]): AlignedRow[] {
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

function countChanges(hunks: Hunk[]): ChangeCounts {
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

function PlainRows({
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
    <div onMouseLeave={() => setHoveredIdx(null)}>
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
              row.kind === 'add' && 'bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]',
              row.kind === 'del' && 'bg-[color-mix(in_oklab,var(--fail)_12%,transparent)]',
              isActive && 'bg-accent/25 ring-1 ring-accent',
              !isActive && isMatch && 'bg-accent/5',
              isHovered && !isActive && (row.kind ? 'brightness-95' : 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')
            )}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{row.newNo ?? row.oldNo ?? ''}</span>
            <GitDiffCodeText kind={row.kind} text={row.text} tokens={tokens} searchNeedle={searchNeedle} isActiveLine={isActive} wrap={wordWrap} diffRanges={row.diffRanges} />
            {isHovered && blame && (
              <span
                className="ml-auto pl-6 pr-3 text-[11px] text-ink-soft/75 select-none font-sans shrink-0 pointer-events-none truncate italic"
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

function splitPairs(rows: AlignedRow[]): Array<{
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

function SplitRows({
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
    <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-line">
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

function HunkBlock({
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
    <div onMouseLeave={() => setHoveredIdx(null)}>
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
              line.kind === 'add' && 'bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]',
              line.kind === 'del' && 'bg-[color-mix(in_oklab,var(--fail)_12%,transparent)]',
              isActive && 'bg-accent/25 ring-1 ring-accent',
              !isActive && isMatch && 'bg-accent/5',
              isHovered && !isActive && (line.kind ? 'brightness-95' : 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')
            )}
          >
            <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{line.oldNo ?? ''}</span>
            <span className="w-10 shrink-0 border-r border-line pr-2 text-right text-ink-soft select-none font-mono">{line.newNo ?? ''}</span>
            <GitDiffCodeText kind={line.kind} text={line.text} tokens={tokens} searchNeedle={searchNeedle} isActiveLine={isActive} wrap={wordWrap} diffRanges={line.diffRanges} />
            {isHovered && blame && (
              <span
                className="ml-auto pl-6 pr-3 text-[11px] text-ink-soft/75 select-none font-sans shrink-0 pointer-events-none truncate italic"
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

function CountMarks({ counts }: { counts: ChangeCounts }) {
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

function fileStatus(status: string, t: TFn): { label: string; className: string; Icon: typeof TiPlusOutline } {
  if (status === 'A' || status === 'C') return { label: t('git.status.add'), className: 'text-ok', Icon: TiPlusOutline }
  if (status === 'D') return { label: t('git.status.delete'), className: 'text-fail', Icon: TiMinusOutline }
  return { label: status === 'R' ? t('git.status.rename') : t('git.status.modify'), className: 'text-warn', Icon: LuPencil }
}

export function GitFileDiff({ repo, hash, path, status = 'M', onClose, onPrevFile: _onPrevFile, onNextFile: _onNextFile, hasConflict, onOpenConflictView }: Props) {
  const t = useT()
  const parentHash = hash === 'WORKTREE' ? 'HEAD' : `${hash}~1`
  const beforeBlameMap = useGitBlame(repo, path, parentHash)
  const afterBlameMap = useGitBlame(repo, path, hash)
  const [wordWrap, setWordWrap] = useGitUiPref('diff.wordWrap', false, isBoolean)
  const kind = gitFileKind(path)
  const previewable = kind === 'image' || kind === 'svg' || kind === 'markdown'
  const [mode, setMode] = useGitUiPref('diff.mode', (previewable ? 'file' : 'diff') as Mode, isMode)
  const [viewport, setViewport] = useGitUiPref('diff.viewport', 'group' as Viewport, isViewport)
  const paneKey = kind === 'svg' ? 'preview.svgPane' : 'preview.markdownPane'
  const [pane, setPane] = useGitUiPref(paneKey, 'preview' as GitFilePane, isPane)
  const [changes, setChanges] = useState<GitCommitChanges | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const mark = fileStatus(status, t)
  const StatusIcon = mark.Icon
  const modeItems = useMemo(
    () => [
      { id: 'file' as const, label: t('git.diff.fileView'), icon: <LuFileText />, panelId: 'git-file-view' },
      { id: 'diff' as const, label: t('git.diff.diffView'), icon: <LuGitCompareArrows />, panelId: 'git-diff-view' },
    ],
    [t]
  )
  const paneItems = useMemo(
    () => [
      { id: 'preview' as const, label: t('git.diff.preview'), icon: <LuEye /> },
      { id: 'code' as const, label: t('git.diff.source'), icon: <LuCodeXml /> },
    ],
    [t]
  )
  const viewportItems = useMemo(
    () => [
      { id: 'group' as const, label: t('git.diff.grouped'), icon: <LuListTree /> },
      { id: 'full' as const, label: t('git.diff.full'), icon: <LuRows3 /> },
      { id: 'split' as const, label: t('git.diff.split'), icon: <LuColumns2 /> },
    ],
    [t]
  )
  const resolvedKind = gitFileKind(path, changes?.contentBinary === true)
  const showDiffViewports = resolvedKind === 'text' || resolvedKind === 'markdown' || resolvedKind === 'svg'
  const showFilePane = mode === 'file' && (resolvedKind === 'svg' || resolvedKind === 'markdown')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setChanges(null)
    const driver = getGitDriver()
    driver
      .readCommitDiff({ repo, hash, file: path })
      .then((body) => {
        if (cancelled) return
        if (!body || typeof body.patch !== 'string') {
          setError(t('git.errors.readChanges'))
          return
        }
        setChanges(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('git.errors.readChanges'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repo, hash, path, t])

  const hunks = useMemo(() => parseHunks(changes?.patch || ''), [changes])
  const counts = useMemo(() => countChanges(hunks), [hunks])
  const aligned = useMemo(() => alignFile(changes?.content, changes?.contentMissing === true, hunks), [changes, hunks])

  const sectionRef = useRef<HTMLElement>(null)
  const diffContainerRef = useRef<HTMLDivElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const findShortcut = useGitFindShortcutLabel()

  const [showFind, setShowFind] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)

  const needle = findQuery.trim().toLowerCase()

  const searchableLines = useMemo(() => {
    if (mode === 'file') {
      return (changes?.content || '').replace(/\n$/, '').split('\n')
    }
    if (viewport === 'full' || viewport === 'split') {
      return aligned.map((row) => row.text)
    }
    if (hunks.length === 0) return (changes?.content || '').replace(/\n$/, '').split('\n')
    return hunks.flatMap((hunk) => hunk.lines.map((l) => l.text))
  }, [mode, viewport, changes?.content, aligned, hunks])

  const matches = useMemo(() => {
    if (!needle || searchableLines.length === 0) return []
    const result: number[] = []
    searchableLines.forEach((line, idx) => {
      if (line.toLowerCase().includes(needle)) {
        result.push(idx)
      }
    })
    return result
  }, [needle, searchableLines])

  useEffect(() => {
    setMatchIndex(0)
  }, [needle])

  const stepMatch = useCallback(
    (delta: number) => {
      if (matches.length === 0) return
      setMatchIndex((prev) => {
        const next = (prev + delta + matches.length) % matches.length
        const targetLineIndex = matches[next]
        const el = diffContainerRef.current?.querySelector(`[data-diff-line-idx="${targetLineIndex}"]`)
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        return next
      })
    },
    [matches]
  )

  useEffect(() => {
    if (matches.length > 0) {
      const firstIdx = matches[0]
      const el = diffContainerRef.current?.querySelector(`[data-diff-line-idx="${firstIdx}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }, [matches])

  useGitFindPanel(sectionRef, findInputRef, () => {
    if (mode === 'diff' && viewport === 'split') {
      sectionRef.current?.querySelector('[data-git-find="code"]')?.dispatchEvent(new CustomEvent(GIT_FIND_EVENT))
    } else setShowFind(true)
  })

  const hunkOffsets = useMemo(() => {
    const offsets: number[] = []
    let acc = 0
    for (const hunk of hunks) {
      offsets.push(acc)
      acc += hunk.lines.length
    }
    return offsets
  }, [hunks])

  const fullChangeBlocks = useMemo(() => {
    const blocks: Array<{ lineIndex: number; count: number }> = []
    let inBlock = false
    let startIdx = 0
    let count = 0
    for (let i = 0; i < aligned.length; i++) {
      const isChange = aligned[i].kind === 'add' || aligned[i].kind === 'del'
      if (isChange) {
        if (!inBlock) {
          inBlock = true
          startIdx = i
          count = 0
        }
        count++
      } else {
        if (inBlock) {
          blocks.push({ lineIndex: startIdx, count })
          inBlock = false
        }
      }
    }
    if (inBlock) {
      blocks.push({ lineIndex: startIdx, count })
    }
    return blocks
  }, [aligned])

  const groupChangeBlocks = useMemo(() => {
    const blocks: Array<{ lineIndex: number; count: number }> = []
    for (let hIdx = 0; hIdx < hunks.length; hIdx++) {
      const hunk = hunks[hIdx]
      const offset = hunkOffsets[hIdx] ?? 0
      let inBlock = false
      let startIdx = 0
      let count = 0
      for (let i = 0; i < hunk.lines.length; i++) {
        const line = hunk.lines[i]
        const isChange = line.kind === 'add' || line.kind === 'del'
        if (isChange) {
          if (!inBlock) {
            inBlock = true
            startIdx = offset + i
            count = 0
          }
          count++
        } else {
          if (inBlock) {
            blocks.push({ lineIndex: startIdx, count })
            inBlock = false
          }
        }
      }
      if (inBlock) {
        blocks.push({ lineIndex: startIdx, count })
      }
    }
    return blocks
  }, [hunks, hunkOffsets])

  const activeChangeBlocks = useMemo(() => {
    if (viewport === 'full' || viewport === 'split') return fullChangeBlocks
    return groupChangeBlocks
  }, [viewport, fullChangeBlocks, groupChangeBlocks])

  const [changeNavigation, setChangeNavigation] = useState({ index: -1, sequence: 0 })
  const activeChangeLineIndex = activeChangeBlocks[changeNavigation.index]?.lineIndex

  useEffect(() => {
    setChangeNavigation({ index: -1, sequence: 0 })
  }, [path, hash, viewport])

  const stepChange = useCallback(
    (delta: number) => {
      if (activeChangeBlocks.length === 0) return
      setChangeNavigation((previous) => ({
        index: previous.index < 0 ? (delta > 0 ? 0 : activeChangeBlocks.length - 1) : (previous.index + delta + activeChangeBlocks.length) % activeChangeBlocks.length,
        sequence: previous.sequence + 1,
      }))
    },
    [activeChangeBlocks]
  )

  useEffect(() => {
    if (activeChangeLineIndex === undefined) return
    diffContainerRef.current?.querySelector(`[data-diff-line-idx="${activeChangeLineIndex}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeChangeLineIndex, changeNavigation.sequence])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'F7' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'j'))) {
        e.preventDefault()
        stepChange(e.shiftKey ? -1 : 1)
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'k')) {
        e.preventDefault()
        stepChange(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stepChange])

  const activeLineIndex = showFind && needle && matches.length > 0 ? matches[matchIndex] : activeChangeLineIndex

  return (
    <section
      ref={sectionRef}
      tabIndex={0}
      onPointerDown={(event) => {
        if (!(event.target as Element).closest('button,input,textarea,a,[data-git-find="code"]')) sectionRef.current?.focus({ preventScroll: true })
      }}
      data-git-find="diff"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-panel"
      aria-label={t('git.diff.aria')}
    >
      <header className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line px-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusIcon className={cn('size-3.5 shrink-0', mark.className)} aria-label={mark.label} />
          <h2 className="m-0 min-w-0 truncate text-xs text-ink" title={path}>
            {path}
          </h2>
          <CountMarks counts={counts} />
        </div>
        <div className="justify-self-center flex items-center gap-2">
          <SegmentedNav aria-label={t('git.diff.contentMode')} size="mini" value={mode} onChange={setMode} items={modeItems} />
          {showFilePane ? (
            <SegmentedNav aria-label={resolvedKind === 'svg' ? t('git.diff.svgView') : t('git.diff.markdownView')} size="mini" value={pane} onChange={setPane} items={paneItems} />
          ) : null}
          {mode === 'diff' && showDiffViewports ? (
            <SegmentedNav aria-label={t('git.diff.viewport')} size="mini" value={viewport} onChange={setViewport} items={viewportItems} />
          ) : null}
          <SegmentedNav
            aria-label={t('git.diff.wrapMode')}
            size="mini"
            value={wordWrap ? 'wrap' : 'nowrap'}
            onChange={(val) => setWordWrap(val === 'wrap')}
            items={[
              { id: 'nowrap', label: t('git.diff.noWrap'), icon: <LuAlignLeft /> },
              { id: 'wrap', label: t('git.diff.wrap'), icon: <LuWrapText /> },
            ]}
          />
        </div>
        <div className="flex items-center justify-end gap-1">
          {mode === 'diff' && activeChangeBlocks.length > 0 && (
            <span className="mr-1 text-xs text-ink-soft tabular-nums font-mono">
              {changeNavigation.index >= 0 ? `${changeNavigation.index + 1}/${activeChangeBlocks.length}` : `${activeChangeBlocks.length}`}
            </span>
          )}
          {mode === 'diff' && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="plain"
                size="mini"
                disabled={loading || activeChangeBlocks.length === 0}
                aria-label={t('git.diff.prevChange')}
                title={t('git.diff.prevChange')}
                onClick={() => stepChange(-1)}
              >
                <LuChevronUp className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="plain"
                size="mini"
                disabled={loading || activeChangeBlocks.length === 0}
                aria-label={t('git.diff.nextChange')}
                title={t('git.diff.nextChange')}
                onClick={() => stepChange(1)}
              >
                <LuChevronDown className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}

          {!(mode === 'diff' && viewport === 'split') && (
            <Button
              variant={showFind ? 'default' : 'plain'}
              size="mini"
              aria-label={t('git.diff.searchContent')}
              title={`${t('git.diff.searchContent')} (${findShortcut})`}
              onClick={() => {
                setShowFind((prev) => {
                  const next = !prev
                  if (next) {
                    setTimeout(() => findInputRef.current?.focus(), 50)
                  }
                  return next
                })
              }}
            >
              <LuSearch className="size-3.5" aria-hidden />
            </Button>
          )}
          {hasConflict && onOpenConflictView ? (
            <Tooltip content={t('git.diff.conflictComparison')}>
              <Button variant="plain" size="mini" onClick={onOpenConflictView} aria-label={t('git.diff.conflictComparison')}>
                <LuGitMerge className="size-3.5 text-warn" />
              </Button>
            </Tooltip>
          ) : null}
          <Button variant="plain" size="mini" aria-label={t('git.diff.close')} onClick={onClose}>
            <LuX className="size-3.5" aria-hidden />
          </Button>
        </div>
      </header>

      {/* Floating Find Box in Detail View */}
      {showFind && !(mode === 'diff' && viewport === 'split') ? (
        <div className="absolute top-12 right-4 z-30">
          <GitFindBox
            inputRef={findInputRef}
            value={findQuery}
            onChange={setFindQuery}
            onClose={() => setShowFind(false)}
            onPrev={() => stepMatch(-1)}
            onNext={() => stepMatch(1)}
            current={matchIndex}
            total={matches.length}
            placeholder={t('git.diff.searchPlaceholder') || '搜索代码或差异内容…'}
            ariaLabel={t('git.diff.searchContent') || '搜索代码或差异内容'}
          />
        </div>
      ) : null}

      {error ? (
        <p className="m-0 px-3 py-2 text-xs text-fail">{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-2 px-3 py-2" aria-hidden>
          <div className="h-4 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-4 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-4 w-2/3 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
        </div>
      ) : mode === 'file' ? (
        <div id="git-file-view" ref={diffContainerRef} role="tabpanel" aria-label={t('git.diff.fileView')} className="flex min-h-0 flex-1 flex-col">
          <GitFilePreview
            kind={resolvedKind}
            repo={repo}
            hash={hash}
            path={path}
            content={changes?.content}
            missing={changes?.contentMissing === true}
            binary={changes?.contentBinary === true}
            truncated={changes?.contentTruncated === true}
            pane={pane}
            searchNeedle={needle}
            activeLineIndex={activeLineIndex}
          />
        </div>
      ) : resolvedKind === 'image' ? (
        <div id="git-diff-view" role="tabpanel" aria-label={t('git.diff.diffView')} className="flex min-h-0 flex-1 flex-col">
          <p className="m-0 border-b border-line px-3 py-2 text-xs text-ink-soft">{t('git.diff.imagePreviewNote')}</p>
          <GitFilePreview kind="image" repo={repo} hash={hash} path={path} missing={changes?.contentMissing === true} binary />
        </div>
      ) : changes?.contentBinary && resolvedKind === 'binary' ? (
        <EmptyState density="compact" className="px-3 py-8" title={t('git.diff.cannotPreview')} message={t('git.diff.binary')} />
      ) : viewport === 'group' && hunks.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="m-0 border-b border-line p-2 text-xs text-ink-soft">{t('git.diff.noTextDiff')}</p>
          <GitFilePreview
            kind={resolvedKind}
            repo={repo}
            hash={hash}
            path={path}
            content={changes?.content}
            missing={changes?.contentMissing === true}
            binary={changes?.contentBinary}
            truncated={changes?.contentTruncated}
            searchNeedle={needle}
            activeLineIndex={activeLineIndex}
          />
        </div>
      ) : (viewport === 'full' || viewport === 'split') && aligned.length === 0 ? (
        <EmptyState density="compact" className="px-3 py-8" title={t('git.diff.noChanges')} message={t('git.diff.noTextDiff')} />
      ) : viewport === 'split' ? (
        <SplitRows
          rows={aligned}
          path={path}
          activeIndex={activeChangeLineIndex}
          targetSequence={changeNavigation.sequence}
          wordWrap={wordWrap}
          beforeBlameMap={beforeBlameMap}
          afterBlameMap={afterBlameMap}
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1" indicator={wordWrap ? 'vertical' : 'both'} reserveGutter={false}>
          <div
            id="git-diff-view"
            ref={diffContainerRef}
            role="tabpanel"
            aria-label={t('git.diff.diffView')}
            className={cn('font-mono text-xs leading-5 pb-[calc(100vh-140px)]', wordWrap ? 'min-w-0 w-full' : 'min-w-full w-max')}
          >
            {viewport === 'full' ? (
              <PlainRows rows={aligned} path={path} activeIndex={activeLineIndex} searchNeedle={needle} wordWrap={wordWrap} blameMap={afterBlameMap} />
            ) : (
              hunks.map((hunk, hunkIndex) => (
                <div key={`${hunk.header}:${hunkIndex}`} className={hunkIndex > 0 ? 'border-t border-line' : undefined}>
                  <HunkBlock
                    hunk={hunk}
                    path={path}
                    lineOffset={hunkOffsets[hunkIndex]}
                    activeIndex={activeLineIndex}
                    searchNeedle={needle}
                    wordWrap={wordWrap}
                    blameMap={afterBlameMap}
                  />
                </div>
              ))
            )}
            {changes?.truncated ? <p className="m-0 px-3 py-2 font-sans text-ink-soft">{t('git.diff.truncated')}</p> : null}
          </div>
        </ScrollArea>
      )}
    </section>
  )
}
