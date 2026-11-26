'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuAlignLeft,
  LuChevronDown,
  LuChevronUp,
  LuCodeXml,
  LuColumns2,
  LuEye,
  LuFileClock,
  LuFileCode,
  LuFileText,
  LuFingerprint,
  LuGitCompareArrows,
  LuGitMerge,
  LuListTree,
  LuRows3,
  LuSearch,
  LuUser,
  LuWrapText,
  LuX,
} from 'react-icons/lu'

import {
  alignFile,
  countChanges,
  CountMarks,
  fileStatus,
  HunkBlock,
  isBoolean,
  isMode,
  isPane,
  isViewport,
  type Mode,
  parseHunks,
  PlainRows,
  rowsFor,
  SplitRows,
  type Viewport,
} from '@/components/git/diff/DiffViewHelpers'
import { gitFileKind } from '@/components/git/fileKind'
import { GitCodePane } from '@/components/git/GitCodePane'
import { GitFileBlameView } from '@/components/git/GitFileBlameView'
import { GitFileHistoryView } from '@/components/git/GitFileHistoryView'
import { type GitFilePane, GitFilePreview } from '@/components/git/GitFilePreview'
import { GIT_FIND_EVENT, useGitFindPanel, useGitFindShortcutLabel } from '@/components/git/gitFind'
import { GitFindBox } from '@/components/git/GitFindBox'
import { useGitBlame } from '@/components/git/useGitBlame'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, EmptyState, ScrollArea, SegmentedNav, Tooltip } from '@/components/sk'
import { fetchRemergeDiff, type MergeConflictRecord } from '@/lib/git/conflict-cache'
import { conflictRegions, fileRemergePatch } from '@/lib/git/conflict-regions'
import { getGitDriver } from '@/lib/git/driver'
import { analyzeMergeTopology } from '@/lib/git/topology'
import { GIT_WORKTREE_HASH, type GitCommit, type GitCommitChanges } from '@/lib/git/types'
import { useGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

type Props = {
  repo: string
  hash: string
  path: string
  status?: string
  commit?: GitCommit
  commits?: GitCommit[]
  conflict?: MergeConflictRecord
  isConflictActive?: boolean
  onToggleConflict?: (active: boolean) => void
  onClose: () => void
  onPrevFile?: () => void
  onNextFile?: () => void
  fileIndex?: number
  fileCount?: number
  hasConflict?: boolean
  onOpenConflictView?: () => void
  initialTab?: 'diff' | 'history' | 'blame'
  onTabChange?: (tab: 'diff' | 'history' | 'blame') => void
  onLocateCommit?: (hash: string) => void
  onOpenFileHistory?: (path: string) => void
  onOpenFileBlame?: (path: string) => void
}

export function GitFileDiff({
  repo,
  hash,
  path,
  status = 'M',
  commit,
  commits = [],
  conflict,
  isConflictActive,
  onToggleConflict,
  onClose,
  onPrevFile: _onPrevFile,
  onNextFile: _onNextFile,
  hasConflict,
  onOpenConflictView: _onOpenConflictView,
  initialTab,
  onTabChange,
  onLocateCommit,
  onOpenFileHistory: _onOpenFileHistory,
  onOpenFileBlame: _onOpenFileBlame,
}: Props) {
  const t = useT()
  const [tabInternal, setTabInternal] = useState<'diff' | 'history' | 'blame'>(initialTab || 'diff')
  const activeTab = initialTab ?? tabInternal

  useEffect(() => {
    if (initialTab) setTabInternal(initialTab)
  }, [initialTab])

  const [conflictActiveInternal, setConflictActiveInternal] = useState(false)
  const conflictActive = isConflictActive !== undefined ? isConflictActive : conflictActiveInternal
  const setConflictActive = (active: boolean) => {
    if (onToggleConflict) onToggleConflict(active)
    else setConflictActiveInternal(active)
  }

  const p1Hash = commit?.parents?.[0] || ''
  const p2Hash = commit?.parents?.[1] || ''
  const [conflictViewMode, setConflictViewMode] = useState<'3way' | 'remerge'>('3way')
  const [conflictContents, setConflictContents] = useState<[string | null, string | null, string | null]>([null, null, null])
  const [remergeDiff, setRemergeDiff] = useState('')
  const [conflictLoading, setConflictLoading] = useState(false)
  const [conflictNavigation, setConflictNavigation] = useState({ index: -1, sequence: 0 })

  const topology = useMemo(() => {
    if (!commit || !commits || commits.length === 0) return null
    return analyzeMergeTopology(commit, new Map(commits.map((item) => [item.hash, item])))
  }, [commit, commits])

  const conflictPatch = useMemo(() => fileRemergePatch(remergeDiff, path), [remergeDiff, path])
  const regions = useMemo(() => conflictRegions(conflictPatch, [conflictContents[0] ?? '', conflictContents[1] ?? '']), [conflictPatch, conflictContents])
  const conflictRows = useMemo(() => conflictContents.map(rowsFor), [conflictContents])
  const patchRows = useMemo(() => rowsFor(conflictPatch || null), [conflictPatch])
  const activeRegion = regions[conflictNavigation.index]

  const p1Commit = useMemo(() => commits.find((c) => c.hash === p1Hash), [commits, p1Hash])
  const p2Commit = useMemo(() => commits.find((c) => c.hash === p2Hash), [commits, p2Hash])
  const p1BlameMap = useGitBlame(repo, path, p1Hash)
  const p2BlameMap = useGitBlame(repo, path, p2Hash)
  const resultBlameMap = useGitBlame(repo, path, hash)

  useEffect(() => {
    if ((!conflictActive && !hasConflict && !(commit && commit.parents.length > 1)) || !p1Hash || !p2Hash || !path) return
    let cancelled = false
    setConflictLoading(true)
    const blob = async (h: string) => {
      if (!h || !path) return null
      try {
        const res = await getGitDriver().readBlob({ repo, hash: h, path })
        return res.binary ? null : res.content
      } catch {
        return null
      }
    }
    void Promise.all([blob(p1Hash), blob(p2Hash), blob(hash), fetchRemergeDiff(repo, hash).catch(() => ({ diff: '' }))]).then(([first, second, merged, diff]) => {
      if (cancelled) return
      setConflictContents([first, second, merged])
      setRemergeDiff(diff.diff)
      setConflictLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [repo, hash, p1Hash, p2Hash, path, hasConflict, conflictActive, commit])

  useEffect(() => {
    if (regions.length > 0 && conflictNavigation.index === -1) {
      setConflictNavigation({ index: 0, sequence: 1 })
    }
  }, [regions, conflictNavigation.index])

  const stepConflict = (delta: number) =>
    setConflictNavigation((previous) => ({
      index: previous.index < 0 ? (delta > 0 ? 0 : regions.length - 1) : (previous.index + delta + regions.length) % regions.length,
      sequence: previous.sequence + 1,
    }))

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

  type ViewMode = 'file' | 'diff' | 'history' | 'blame'

  const currentView: ViewMode = useMemo(() => {
    if (activeTab === 'history') return 'history'
    if (activeTab === 'blame') return 'blame'
    return mode === 'file' ? 'file' : 'diff'
  }, [activeTab, mode])

  const handleViewChange = useCallback(
    (nextView: string) => {
      const v = nextView as ViewMode
      if (v === 'file') {
        setMode('file')
        setTabInternal('diff')
        onTabChange?.('diff')
      } else if (v === 'diff') {
        setMode('diff')
        setTabInternal('diff')
        onTabChange?.('diff')
      } else if (v === 'history') {
        setTabInternal('history')
        onTabChange?.('history')
      } else if (v === 'blame') {
        setTabInternal('blame')
        onTabChange?.('blame')
      }
    },
    [setMode, onTabChange]
  )

  const modeItems = useMemo(
    () => [
      { id: 'file' as const, label: t('git.diff.fileView'), icon: <LuFileText />, panelId: 'git-file-view' },
      { id: 'diff' as const, label: t('git.diff.diffView'), icon: <LuGitCompareArrows />, panelId: 'git-diff-view' },
      { id: 'history' as const, label: t('git.operations.fileHistory') || 'File History', icon: <LuFileClock />, panelId: 'git-history-view' },
      { id: 'blame' as const, label: t('git.operations.fileBlame') || 'File Blame', icon: <LuFingerprint />, panelId: 'git-blame-view' },
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
  const showFilePane = currentView === 'file' && (resolvedKind === 'svg' || resolvedKind === 'markdown')

  const tRef = useRef(t)
  tRef.current = t

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
          setError(tRef.current('git.errors.readChanges'))
          return
        }
        setChanges(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : tRef.current('git.errors.readChanges'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repo, hash, path])

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

  useEffect(() => {
    setFindQuery('')
    setShowFind(false)
  }, [repo, path])

  useEffect(() => {
    function onClearSearches() {
      setFindQuery('')
      setShowFind(false)
    }
    window.addEventListener('yggit:clear_searches', onClearSearches)
    return () => window.removeEventListener('yggit:clear_searches', onClearSearches)
  }, [])

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

  const [changeNavigation, setChangeNavigation] = useState({ index: 0, sequence: 0 })
  const activeChangeLineIndex = changeNavigation.sequence > 0 ? activeChangeBlocks[changeNavigation.index]?.lineIndex : undefined

  useEffect(() => {
    setChangeNavigation({ index: 0, sequence: 0 })
  }, [path, hash, viewport])

  const stepChange = useCallback(
    (delta: number) => {
      if (activeChangeBlocks.length === 0) return
      setChangeNavigation((previous) => ({
        index: (previous.index + delta + activeChangeBlocks.length) % activeChangeBlocks.length,
        sequence: previous.sequence + 1,
      }))
    },
    [activeChangeBlocks]
  )

  useEffect(() => {
    if (activeChangeLineIndex === undefined || changeNavigation.sequence === 0) return
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
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-panel outline-none"
      aria-label={t('git.diff.aria')}
    >
      <header className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line px-2">
        <div className="flex min-w-0 items-center gap-2">
          {conflictActive ? (
            <LuGitMerge className="size-4 shrink-0 text-warn" aria-hidden />
          ) : (
            <StatusIcon className={cn('size-4 shrink-0', mark.className)} aria-label={mark.label} />
          )}
          {(() => {
            const lastSlash = path.lastIndexOf('/')
            const dirPrefix = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : ''
            const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path
            return (
              <h2 className="m-0 flex min-w-0 items-center text-xs text-ink font-medium" title={path}>
                {dirPrefix ? <span className="truncate text-ink-soft/70 select-none">{dirPrefix}</span> : null}
                <span className="shrink-0 font-semibold text-ink">{fileName}</span>
              </h2>
            )
          })()}
          {conflictActive ? (
            <span className="shrink-0 text-ink-soft text-[11px] font-normal" title={commit?.author ? `${commit.author} · ${commit.date}` : undefined}>
              ({t('git.diff.conflictComparison') || 'Conflict'})
            </span>
          ) : (
            <CountMarks counts={counts} />
          )}
          {commit && commit.hash !== GIT_WORKTREE_HASH && commit.author ? (
            <span
              className="hidden md:inline-flex items-center gap-1 shrink-0 text-ink-soft text-[11px] font-normal border-l border-line pl-2"
              title={`${commit.author} (${commit.short || commit.hash.slice(0, 7)}) · ${commit.date}`}
            >
              <LuUser className="size-3 text-ink-soft" />
              <span className="truncate max-w-[120px]">{commit.author}</span>
            </span>
          ) : null}
        </div>
        <div className="justify-self-center flex items-center justify-start gap-2 min-w-0 sm:min-w-[310px]">
          {conflictActive ? (
            <SegmentedNav
              aria-label={t('git.diff.conflictMode')}
              size="mini"
              value={conflictViewMode}
              onChange={(val) => setConflictViewMode(val as '3way' | 'remerge')}
              items={[
                { id: '3way', label: t('git.diff.threeWay'), icon: <LuColumns2 /> },
                { id: 'remerge', label: 'Remerge Diff', icon: <LuRows3 /> },
              ]}
            />
          ) : (
            <>
              {/* Group 1: Content Mode (always present) */}
              <SegmentedNav aria-label={t('git.diff.contentMode')} size="mini" value={currentView} onChange={handleViewChange} items={modeItems} />

              {/* Group 2: Word Wrap Mode (always present, placed before contextual items to keep Group 1 & 2 position rock-solid) */}
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

              {/* Group 3: Contextual Diff Viewport or File Pane (Markdown/SVG preview) */}
              {currentView === 'diff' && showDiffViewports ? (
                <SegmentedNav aria-label={t('git.diff.viewport')} size="mini" value={viewport} onChange={setViewport} items={viewportItems} />
              ) : null}
              {showFilePane ? (
                <SegmentedNav
                  aria-label={resolvedKind === 'svg' ? t('git.diff.svgView') : t('git.diff.markdownView')}
                  size="mini"
                  value={pane}
                  onChange={setPane}
                  items={paneItems}
                />
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-1">
          {/* Stepper count */}
          <span className="min-w-[36px] text-center text-xs text-ink-soft tabular-nums font-mono select-none">
            {conflictActive
              ? regions.length > 0
                ? conflictNavigation.index >= 0
                  ? `${conflictNavigation.index + 1}/${regions.length}`
                  : `${regions.length}`
                : ''
              : activeChangeBlocks.length > 0
                ? `${(((changeNavigation.index % activeChangeBlocks.length) + activeChangeBlocks.length) % activeChangeBlocks.length) + 1}/${activeChangeBlocks.length}`
                : ''}
          </span>

          {/* Stepper navigation buttons (up/down) */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="plain"
              size="mini"
              disabled={conflictActive ? conflictLoading || !regions.length : loading || activeChangeBlocks.length === 0}
              aria-label={conflictActive ? t('git.diff.previousConflict') : t('git.diff.prevChange')}
              title={conflictActive ? t('git.diff.previousConflict') : t('git.diff.prevChange')}
              onClick={() => (conflictActive ? stepConflict(-1) : stepChange(-1))}
            >
              <LuChevronUp className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="plain"
              size="mini"
              disabled={conflictActive ? conflictLoading || !regions.length : loading || activeChangeBlocks.length === 0}
              aria-label={conflictActive ? t('git.diff.nextConflict') : t('git.diff.nextChange')}
              title={conflictActive ? t('git.diff.nextConflict') : t('git.diff.nextChange')}
              onClick={() => (conflictActive ? stepConflict(1) : stepChange(1))}
            >
              <LuChevronDown className="size-3.5" aria-hidden="true" />
            </Button>
          </div>

          {/* Search Button (Diff Mode) */}
          {!conflictActive ? (
            <Button
              variant={showFind ? 'default' : 'plain'}
              size="mini"
              aria-label={t('git.diff.searchContent')}
              title={`${t('git.diff.searchContent')} (${findShortcut})`}
              onClick={() => {
                setShowFind((prev) => {
                  const next = !prev
                  if (next) setTimeout(() => findInputRef.current?.focus(), 50)
                  return next
                })
              }}
            >
              <LuSearch className="size-3.5" aria-hidden />
            </Button>
          ) : null}

          {/* Conflict / Changes toggle button */}
          {hasConflict || Boolean(conflict?.hasConflict) || Boolean(commit && commit.parents.length > 1) ? (
            <Tooltip
              content={
                !hasConflict && !conflict?.hasConflict && !conflictActive
                  ? t('git.diff.noConflict') || 'No conflict in current file'
                  : conflictActive
                    ? t('git.diff.diffView') || 'Diff'
                    : t('git.diff.conflictComparison') || 'Conflict'
              }
            >
              <Button
                variant="plain"
                size="mini"
                disabled={!hasConflict && !conflict?.hasConflict && !conflictActive}
                className={!hasConflict && !conflict?.hasConflict && !conflictActive ? 'opacity-40 cursor-not-allowed' : ''}
                onClick={() => {
                  if (hasConflict || conflict?.hasConflict || conflictActive) {
                    setConflictActive(!conflictActive)
                  }
                }}
                aria-label={conflictActive ? t('git.diff.diffView') : t('git.diff.conflictComparison')}
              >
                {conflictActive ? <LuFileCode className="size-3.5 text-accent" /> : <LuGitMerge className="size-3.5 text-warn" />}
              </Button>
            </Tooltip>
          ) : null}

          {/* Close button */}
          <Button variant="plain" size="mini" aria-label={t('common.close')} onClick={onClose}>
            <LuX className="size-3.5" aria-hidden />
          </Button>
        </div>
      </header>

      {/* Floating Find Box in Detail View */}
      {showFind && !conflictActive && !(mode === 'diff' && viewport === 'split') ? (
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
            placeholder={t('git.diff.searchPlaceholder') || 'Search code or diff…'}
            ariaLabel={t('git.diff.searchContent') || 'Search code or diff'}
          />
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <GitFileHistoryView repo={repo} path={path} currentHash={hash} wordWrap={wordWrap} searchQuery={findQuery} onLocateCommit={onLocateCommit} />
      ) : activeTab === 'blame' ? (
        <GitFileBlameView repo={repo} path={path} hash={hash} wordWrap={wordWrap} searchNeedle={needle} onLocateCommit={onLocateCommit} />
      ) : conflictActive ? (
        conflictViewMode === '3way' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 bg-paper p-2">
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              <GitCodePane
                label={`${t('git.diff.parentOne')} · ${topology?.targetBranchHint || p1Hash.slice(0, 7)}${p1Commit?.author ? ` (${p1Commit.author})` : ''}`}
                path={path}
                rows={conflictRows[0]}
                loading={conflictLoading}
                targetLine={activeRegion?.parents[0]}
                targetSequence={conflictNavigation.sequence}
                wordWrap={wordWrap}
                blameMap={p1BlameMap}
              />
              <GitCodePane
                label={`${t('git.diff.parentTwo')} · ${topology?.sourceBranchHint || p2Hash.slice(0, 7)}${p2Commit?.author ? ` (${p2Commit.author})` : ''}`}
                path={path}
                rows={conflictRows[1]}
                loading={conflictLoading}
                targetLine={activeRegion?.parents[1]}
                targetSequence={conflictNavigation.sequence}
                wordWrap={wordWrap}
                blameMap={p2BlameMap}
              />
            </div>
            <GitCodePane
              label={`${t('git.diff.mergeResult')} · ${hash.slice(0, 7)}${commit?.author ? ` (${commit.author})` : ''}`}
              path={path}
              rows={conflictRows[2]}
              loading={conflictLoading}
              targetLine={activeRegion?.result}
              targetSequence={conflictNavigation.sequence}
              wordWrap={wordWrap}
              blameMap={resultBlameMap}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col p-2 bg-paper">
            <GitCodePane
              label={`Remerge Diff · ${hash.slice(0, 7)}${commit?.author ? ` (${commit.author})` : ''}`}
              path={path}
              rows={patchRows}
              loading={conflictLoading}
              targetLine={activeRegion?.patch}
              targetSequence={conflictNavigation.sequence}
              wordWrap={wordWrap}
              blameMap={resultBlameMap}
            />
          </div>
        )
      ) : error ? (
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
          {!changes?.contentMissing && <p className="m-0 border-b border-line px-3 py-2 text-xs text-ink-soft">{t('git.diff.imagePreviewNote')}</p>}
          <GitFilePreview kind="image" repo={repo} hash={hash} path={path} missing={changes?.contentMissing === true} binary />
        </div>
      ) : changes?.contentBinary && resolvedKind === 'binary' ? (
        <EmptyState density="panel" className="flex-1 h-full min-h-0" title={t('git.diff.cannotPreview')} message={t('git.diff.binary')} />
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
        <EmptyState density="panel" className="flex-1 h-full min-h-0" title={t('git.diff.noChanges')} message={t('git.diff.noTextDiff')} />
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
