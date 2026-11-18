'use client'

import { useEffect, useMemo, useState } from 'react'
import { LuChevronDown, LuChevronUp, LuColumns2, LuFileCode, LuGitMerge, LuRows3, LuX } from 'react-icons/lu'

import { GitCodePane } from '@/components/git/GitCodePane'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, SegmentedNav } from '@/components/sk'
import { fetchRemergeDiff, type MergeConflictRecord } from '@/lib/git/conflict-cache'
import { conflictRegions, fileRemergePatch } from '@/lib/git/conflict-regions'
import { analyzeMergeTopology } from '@/lib/git/topology'
import type { GitCommit } from '@/lib/git/types'

interface Props {
  repo?: string
  commit: GitCommit
  commits: GitCommit[]
  conflict?: MergeConflictRecord
  selectedPath: string
  onSelectPath: (path: string) => void
  onClose: () => void
}

const rowsFor = (content: string | null) =>
  content === null
    ? []
    : content
        .replace(/\n$/, '')
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))

export function GitConflict3WayDiff({ repo = '', commit, commits, conflict, selectedPath, onClose }: Props) {
  const t = useT()
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
        </div>
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
        <div className="flex items-center justify-end gap-1">
          <Button variant="plain" size="mini" disabled={loading || !regions.length} aria-label={t('git.diff.previousConflict')} onClick={() => step(-1)}>
            <LuChevronUp />
          </Button>
          <Button variant="plain" size="mini" disabled={loading || !regions.length} aria-label={t('git.diff.nextConflict')} onClick={() => step(1)}>
            <LuChevronDown />
          </Button>
          <Button variant="plain" size="mini" aria-label={t('common.close')} onClick={onClose}>
            <LuX />
          </Button>
        </div>
      </header>
      {viewMode === '3way' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 bg-paper p-2">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
            <GitCodePane
              label={`${t('git.diff.parentOne')} · ${topology?.targetBranchHint || p1Hash.slice(0, 7)}`}
              path={currentPath}
              rows={rows[0]}
              loading={loading}
              targetLine={active?.parents[0]}
              targetSequence={navigation.sequence}
            />
            <GitCodePane
              label={`${t('git.diff.parentTwo')} · ${topology?.sourceBranchHint || p2Hash.slice(0, 7)}`}
              path={currentPath}
              rows={rows[1]}
              loading={loading}
              targetLine={active?.parents[1]}
              targetSequence={navigation.sequence}
            />
          </div>
          <GitCodePane
            label={`${t('git.diff.mergeResult')} · ${commit.hash.slice(0, 7)}`}
            path={currentPath}
            rows={rows[2]}
            loading={loading}
            targetLine={active?.result}
            targetSequence={navigation.sequence}
          />
        </div>
      ) : (
        <GitCodePane label="Remerge Diff" path={currentPath} rows={patchRows} loading={loading} targetLine={active?.patch} targetSequence={navigation.sequence} />
      )}
    </section>
  )
}
