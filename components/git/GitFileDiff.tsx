'use client'

import { useEffect, useMemo, useState } from 'react'
import { LuCodeXml, LuColumns2, LuEye, LuFileText, LuGitCompareArrows, LuListTree, LuMinus, LuPencil, LuRows3, LuX } from 'react-icons/lu'
import { TiPlusOutline } from 'react-icons/ti'
import type { ThemedToken } from 'shiki'

import { gitFileKind } from '@/components/git/fileKind'
import { type GitFilePane, GitFilePreview } from '@/components/git/GitFilePreview'
import { GitDiffCodeText, useGitLineTokens } from '@/components/git/GitHighlightedCode'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, EmptyState, ScrollArea, SegmentedNav } from '@/components/sk'
import { readApiErrorMessage } from '@/lib/api-error'
import type { GitCommitChanges } from '@/lib/git/types'
import { useGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

type Props = {
  repo: string
  hash: string
  path: string
  status?: string
  onClose: () => void
}

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

function PlainRows({ rows, path }: { rows: AlignedRow[]; path: string }) {
  const liveLines = rows.filter((row) => row.kind !== 'del').map((row) => row.text)
  const delLines = rows.filter((row) => row.kind === 'del').map((row) => row.text)
  const liveTokens = useGitLineTokens(liveLines, path)
  const delTokens = useGitLineTokens(delLines, path)
  let liveAt = 0
  let delAt = 0
  return rows.map((row, index) => {
    const tokens = row.kind === 'del' ? delTokens?.[delAt++] : liveTokens?.[liveAt++]
    return (
      <div key={index} className="flex min-w-0">
        <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none">{row.newNo ?? row.oldNo ?? ''}</span>
        <GitDiffCodeText kind={row.kind} text={row.text} tokens={tokens} />
      </div>
    )
  })
}

function splitPairs(rows: AlignedRow[]): Array<{ left?: AlignedRow; right?: AlignedRow }> {
  const pairs: Array<{ left?: AlignedRow; right?: AlignedRow }> = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const next = rows[index + 1]
    if (row.kind === 'del' && next?.kind === 'add') {
      pairs.push({ left: row, right: next })
      index += 1
      continue
    }
    if (row.kind === 'del') {
      pairs.push({ left: row })
      continue
    }
    if (row.kind === 'add') {
      pairs.push({ right: row })
      continue
    }
    pairs.push({ left: row, right: row })
  }
  return pairs
}

function SplitRows({ rows, path }: { rows: AlignedRow[]; path: string }) {
  const t = useT()
  const pairs = splitPairs(rows)
  const leftLines = pairs.map((pair) => pair.left?.text || '')
  const rightLines = pairs.map((pair) => pair.right?.text || '')
  const leftTokens = useGitLineTokens(leftLines, path)
  const rightTokens = useGitLineTokens(rightLines, path)
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-2 border-b border-line font-sans text-ink-soft">
        <span className="px-3 py-1">{t('git.diff.before')}</span>
        <span className="border-l border-line px-3 py-1">{t('git.diff.after')}</span>
      </div>
      {pairs.map((pair, index) => (
        <div key={index} className="grid grid-cols-2 min-w-0">
          <div className="flex min-w-0 overflow-hidden border-r border-line">
            <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none">{pair.left?.oldNo ?? ''}</span>
            <GitDiffCodeText kind={pair.left?.kind || 'context'} text={pair.left?.text || ''} tokens={leftTokens?.[index]} />
          </div>
          <div className="flex min-w-0 overflow-hidden">
            <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none">{pair.right?.newNo ?? ''}</span>
            <GitDiffCodeText kind={pair.right?.kind || 'context'} text={pair.right?.text || ''} tokens={rightTokens?.[index]} />
          </div>
        </div>
      ))}
    </div>
  )
}

function HunkBlock({ hunk, path }: { hunk: Hunk; path: string }) {
  // Highlight old/new sides separately so +/- lines do not break TextMate state.
  const oldLines = hunk.lines.filter((line) => line.kind === 'context' || line.kind === 'del').map((line) => line.text)
  const newLines = hunk.lines.filter((line) => line.kind === 'context' || line.kind === 'add').map((line) => line.text)
  const oldTokens = useGitLineTokens(oldLines, path)
  const newTokens = useGitLineTokens(newLines, path)

  const renderedLines = useMemo(() => {
    let oldAt = 0
    let newAt = 0
    const result: Array<{ line: (typeof hunk.lines)[number]; tokens: ThemedToken[] | undefined }> = []
    for (const line of hunk.lines) {
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
  }, [hunk.lines, oldTokens, newTokens])

  return (
    <>
      <div className="border-b border-line bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] px-3 text-ink-soft">{hunk.header}</div>
      {renderedLines.map(({ line, tokens }, index) => (
        <div key={`${hunk.header}:${index}`} className="flex min-w-0">
          <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none">{line.oldNo ?? ''}</span>
          <span className="w-10 shrink-0 border-r border-line pr-2 text-right text-ink-soft select-none">{line.newNo ?? ''}</span>
          <GitDiffCodeText kind={line.kind} text={line.text} tokens={tokens} />
        </div>
      ))}
    </>
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
          <LuMinus className="size-3" aria-hidden />
          {counts.del}
        </span>
      ) : null}
    </span>
  )
}

type TFn = ReturnType<typeof useT>

function fileStatus(status: string, t: TFn): { label: string; className: string; Icon: typeof TiPlusOutline } {
  if (status === 'A' || status === 'C') return { label: t('git.status.add'), className: 'text-ok', Icon: TiPlusOutline }
  if (status === 'D') return { label: t('git.status.delete'), className: 'text-fail', Icon: LuMinus }
  return { label: status === 'R' ? t('git.status.rename') : t('git.status.modify'), className: 'text-warn', Icon: LuPencil }
}

export function GitFileDiff({ repo, hash, path, status = 'M', onClose }: Props) {
  const t = useT()
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
    const params = new URLSearchParams({ repo, hash, path })
    void fetch(`/api/git/commit?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as GitCommitChanges & { ok?: boolean }
        if (cancelled) return
        if (!response.ok || body.ok === false || typeof body.patch !== 'string') {
          setError(readApiErrorMessage(body, t('git.errors.readChanges')))
          return
        }
        setChanges(body)
      })
      .catch(() => {
        if (!cancelled) setError(t('git.errors.readChanges'))
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

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-panel" aria-label={t('git.diff.aria')}>
      <header className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line px-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusIcon className={cn('size-3.5 shrink-0', mark.className)} aria-label={mark.label} />
          <h2 className="m-0 min-w-0 truncate text-xs text-ink" title={path}>
            {path}
          </h2>
          <CountMarks counts={counts} />
        </div>
        <div className="justify-self-center flex items-center gap-2">
          <SegmentedNav aria-label={t('git.diff.contentMode')} value={mode} onChange={setMode} items={modeItems} />
          {showFilePane ? (
            <SegmentedNav aria-label={resolvedKind === 'svg' ? t('git.diff.svgView') : t('git.diff.markdownView')} value={pane} onChange={setPane} items={paneItems} />
          ) : null}
          {mode === 'diff' && showDiffViewports ? <SegmentedNav aria-label={t('git.diff.viewport')} value={viewport} onChange={setViewport} items={viewportItems} /> : null}
        </div>
        <div className="flex items-center justify-end">
          <Button variant="plain" size="icon" aria-label={t('git.diff.close')} onClick={onClose}>
            <LuX aria-hidden />
          </Button>
        </div>
      </header>
      {error ? (
        <p className="m-0 px-3 py-2 text-xs text-fail">{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-2 px-3 py-2" aria-hidden>
          <div className="h-4 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-4 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-4 w-2/3 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
        </div>
      ) : mode === 'file' ? (
        <div id="git-file-view" role="tabpanel" aria-label={t('git.diff.fileView')} className="flex min-h-0 flex-1 flex-col">
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
        <EmptyState density="compact" className="px-3 py-8" title={t('git.diff.noChanges')} message={t('git.diff.noTextDiff')} />
      ) : (viewport === 'full' || viewport === 'split') && aligned.length === 0 ? (
        <EmptyState density="compact" className="px-3 py-8" title={t('git.diff.noChanges')} message={t('git.diff.noTextDiff')} />
      ) : (
        <ScrollArea className="min-h-0 flex-1" indicator="both" reserveGutter={false}>
          <div id="git-diff-view" role="tabpanel" aria-label={t('git.diff.diffView')} className="min-w-0 font-mono text-xs leading-5">
            {viewport === 'split' ? (
              <SplitRows rows={aligned} path={path} />
            ) : viewport === 'full' ? (
              <PlainRows rows={aligned} path={path} />
            ) : (
              hunks.map((hunk, hunkIndex) => (
                <div key={`${hunk.header}:${hunkIndex}`} className={hunkIndex > 0 ? 'border-t border-line' : undefined}>
                  <HunkBlock hunk={hunk} path={path} />
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
