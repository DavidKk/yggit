'use client'

import { useEffect, useMemo, useState } from 'react'
import { LuAlignLeft, LuChevronDown, LuChevronUp, LuColumns2, LuFileCode, LuGitMerge, LuRows3, LuWrapText, LuX } from 'react-icons/lu'

import { GitCodePane } from '@/components/git/GitCodePane'
import { useGitBlame } from '@/components/git/useGitBlame'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, SegmentedNav, Tooltip } from '@/components/sk'
import { fetchRemergeDiff, type MergeConflictRecord } from '@/lib/git/conflict-cache'
import { conflictRegions, fileRemergePatch } from '@/lib/git/conflict-regions'
import { analyzeMergeTopology } from '@/lib/git/topology'
import type { GitCommit } from '@/lib/git/types'
import { useGitUiPref } from '@/lib/git/ui-prefs'

interface Props {
  repo?: string
  commit: GitCommit
  commits: GitCommit[]
  conflict?: MergeConflictRecord
  selectedPath: string
  onSelectPath: (path: string) => void
  onClose: () => void
  onSwitchToDiff?: () => void
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

const rowsFor = (content: string | null) =>
  content === null
    ? []
    : content
        .replace(/\n$/, '')
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))

export function GitConflict3WayDiff({ repo = '', commit, commits, conflict, selectedPath, onClose, onSwitchToDiff }: Props) {
  const t = useT()
  const [wordWrap, setWordWrap] = useGitUiPref('diff.wordWrap', false, isBoolean)
  const [viewMode, setViewMode] = useState('3way')
  const [contents, setContents] = useState<[string | null, string | null, string | null]>([null, null, null])
  const [remergeDiff, setRemergeDiff] = useState('')
  const [loading, setLoading] = useState(true)
  const [navigation, setNavigation] = useState({ index: -1, sequence: 0 })
  const currentPath = selectedPath || conflict?.conflictFiles?.[0] || ''
  const p1Hash = commit.parents[0] || ''
  const p2Hash = commit.parents[1] || ''
  const topology = useMemo(() => analyzeMergeTopology(commit, new Map(commits.map((item) => [item.hash, item]))), [commit, commits])
  const patch = useMemo(() => fileRemergePatch(remergeDiff, currentPath), [remergeDiff, currentPath])
  const regions = useMemo(() => conflictRegions(patch, [contents[0] ?? '', contents[1] ?? '']), [patch, contents])
  const rows = useMemo(() => contents.map(rowsFor), [contents])
  const patchRows = useMemo(() => rowsFor(patch || null), [patch])
  const active = regions[navigation.index]
  const p1Commit = useMemo(() => commits.find((c) => c.hash === p1Hash), [commits, p1Hash])
  const p2Commit = useMemo(() => commits.find((c) => c.hash === p2Hash), [commits, p2Hash])
  const p1BlameMap = useGitBlame(repo, currentPath, p1Hash)
  const p2BlameMap = useGitBlame(repo, currentPath, p2Hash)
  const resultBlameMap = useGitBlame(repo, currentPath, commit.hash)

  useEffect(() => {
    if (regions.length > 0 && navigation.index === -1) {
      setNavigation({ index: 0, sequence: 1 })
    }
  }, [regions, navigation.index])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setContents([null, null, null])
    setRemergeDiff('')
    setNavigation({ index: -1, sequence: 0 })
    const blob = async (hash: string) => {
      if (!hash || !currentPath) return null
      try {
        const response = await fetch(`/api/git/blob?repo=${encodeURIComponent(repo)}&hash=${encodeURIComponent(hash)}&path=${encodeURIComponent(currentPath)}`)
        return response.ok ? await response.text() : null
      } catch {
        return null
      }
    }
    void Promise.all([blob(p1Hash), blob(p2Hash), blob(commit.hash), fetchRemergeDiff(repo, commit.hash).catch(() => ({ diff: '' }))]).then(([first, second, merged, diff]) => {
      if (cancelled) return
      setContents([first, second, merged])
      setRemergeDiff(diff.diff)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [repo, commit.hash, p1Hash, p2Hash, currentPath])
  const step = (delta: number) =>
    setNavigation((previous) => ({
      index: previous.index < 0 ? (delta > 0 ? 0 : regions.length - 1) : (previous.index + delta + regions.length) % regions.length,
      sequence: previous.sequence + 1,
    }))
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-panel" aria-label={t('git.diff.conflictComparison')}>
      <header className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line px-3">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <LuGitMerge className="size-4 shrink-0 text-warn" />
          <span className="shrink-0 font-semibold">{t('git.diff.conflictComparison')}</span>
          <LuFileCode className="size-3 shrink-0 text-accent" />
          <span className="truncate" title={currentPath}>
            {currentPath}
          </span>
          {commit.author ? (
            <span className="shrink-0 text-ink-soft text-[11px] font-normal" title={`${commit.author} · ${commit.date}`}>
              ({commit.author})
            </span>
          ) : null}
        </div>
        <div className="justify-self-center flex items-center gap-2">
          <SegmentedNav
            aria-label={t('git.diff.conflictMode')}
            size="mini"
            value={viewMode}
            onChange={setViewMode}
            items={[
              { id: '3way', label: t('git.diff.threeWay'), icon: <LuColumns2 /> },
              { id: 'remerge', label: 'Remerge Diff', icon: <LuRows3 /> },
            ]}
          />
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
          {regions.length > 0 && (
            <span className="mr-1 text-xs text-ink-soft tabular-nums font-mono">{navigation.index >= 0 ? `${navigation.index + 1}/${regions.length}` : `${regions.length}`}</span>
          )}
          <Button variant="plain" size="mini" disabled={loading || !regions.length} aria-label={t('git.diff.previousConflict')} onClick={() => step(-1)}>
            <LuChevronUp />
          </Button>
          <Button variant="plain" size="mini" disabled={loading || !regions.length} aria-label={t('git.diff.nextConflict')} onClick={() => step(1)}>
            <LuChevronDown />
          </Button>
          {onSwitchToDiff && (
            <Tooltip content={t('git.diff.diffView')}>
              <Button variant="plain" size="mini" aria-label={t('git.diff.diffView')} onClick={onSwitchToDiff}>
                <LuFileCode className="size-3.5 text-accent" />
              </Button>
            </Tooltip>
          )}
          <Button variant="plain" size="mini" aria-label={t('common.close')} onClick={onClose}>
            <LuX />
          </Button>
        </div>
      </header>
      {viewMode === '3way' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 bg-paper p-2">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
            <GitCodePane
              label={`${t('git.diff.parentOne')} · ${topology?.targetBranchHint || p1Hash.slice(0, 7)}${p1Commit?.author ? ` (${p1Commit.author})` : ''}`}
              path={currentPath}
              rows={rows[0]}
              loading={loading}
              targetLine={active?.parents[0]}
              targetSequence={navigation.sequence}
              wordWrap={wordWrap}
              blameMap={p1BlameMap}
            />
            <GitCodePane
              label={`${t('git.diff.parentTwo')} · ${topology?.sourceBranchHint || p2Hash.slice(0, 7)}${p2Commit?.author ? ` (${p2Commit.author})` : ''}`}
              path={currentPath}
              rows={rows[1]}
              loading={loading}
              targetLine={active?.parents[1]}
              targetSequence={navigation.sequence}
              wordWrap={wordWrap}
              blameMap={p2BlameMap}
            />
          </div>
          <GitCodePane
            label={`${t('git.diff.mergeResult')} · ${commit.hash.slice(0, 7)}${commit.author ? ` (${commit.author})` : ''}`}
            path={currentPath}
            rows={rows[2]}
            loading={loading}
            targetLine={active?.result}
            targetSequence={navigation.sequence}
            wordWrap={wordWrap}
            blameMap={resultBlameMap}
          />
        </div>
      ) : (
        <GitCodePane
          label={`Remerge Diff · ${commit.hash.slice(0, 7)}${commit.author ? ` (${commit.author})` : ''}`}
          path={currentPath}
          rows={patchRows}
          loading={loading}
          targetLine={active?.patch}
          targetSequence={navigation.sequence}
          wordWrap={wordWrap}
          blameMap={resultBlameMap}
        />
      )}
    </section>
  )
}
