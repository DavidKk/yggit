'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuCheck, LuClock, LuCopy, LuCornerDownRight, LuGitCommitVertical, LuSearch, LuUser, LuX } from 'react-icons/lu'

import { GitDiffCodeText, useGitLineTokens } from '@/components/git/GitHighlightedCode'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Spinner, Tooltip } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import { formatCommitAgo } from '@/lib/git/format-commit-ago'
import type { GitCommit, GitCommitChanges } from '@/lib/git/types'
import { cn } from '@/lib/utils'

type DiffLine = { kind: 'add' | 'del' | 'context' | 'meta'; text: string; oldNo?: number; newNo?: number }
type Hunk = { header: string; lines: DiffLine[] }

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
      current.lines.push({ kind: 'del', text: raw.slice(1), oldNo })
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

export function GitFileHistoryView({
  repo,
  path,
  currentHash,
  wordWrap = false,
  searchQuery = '',
  onLocateCommit,
  onCommitCountChange,
}: {
  repo: string
  path: string
  currentHash?: string
  wordWrap?: boolean
  searchQuery?: string
  onLocateCommit?: (hash: string) => void
  onCommitCountChange?: (count: number) => void
}) {
  const t = useT()
  const locale = useLocaleCode()

  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedHash, setSelectedHash] = useState<string>('')
  const [filter, setFilter] = useState('')
  const [copiedHash, setCopiedHash] = useState('')

  // Diff at selected commit
  const [diff, setDiff] = useState<GitCommitChanges | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState('')

  // Load commit history for file
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setSelectedHash('')
    setDiff(null)
    setDiffError('')
    const driver = getGitDriver()
    const fetchHistory = driver.readFileHistory
      ? driver.readFileHistory({ repo, path, ref: currentHash, limit: 100 })
      : fetch(`/api/git/file-history?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}&ref=${encodeURIComponent(currentHash || 'HEAD')}`).then((res) => res.json())

    fetchHistory
      .then((data: { commits?: GitCommit[] }) => {
        if (cancelled) return
        const list = data?.commits || []
        setCommits(list)
        onCommitCountChange?.(list.length)
        if (list.length > 0) {
          // If currentHash matches one of the commits, select it, otherwise select the latest commit
          const match = currentHash ? list.find((c) => c.hash === currentHash || c.short === currentHash) : null
          setSelectedHash(match ? match.hash : list[0].hash)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('git.diff.loadingHistory') || '加载历史失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [repo, path, currentHash, t, onCommitCountChange])

  // Load diff when selectedHash changes
  useEffect(() => {
    if (!selectedHash) {
      setDiff(null)
      return
    }
    let cancelled = false
    setDiffLoading(true)
    setDiffError('')
    const driver = getGitDriver()
    driver
      .readCommitDiff({ repo, hash: selectedHash, file: path })
      .then((data) => {
        if (cancelled) return
        setDiff(data)
      })
      .catch((err) => {
        if (!cancelled) setDiffError(err instanceof Error ? err.message : t('git.errors.readChanges'))
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [repo, selectedHash, path, t])

  const filteredCommits = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return commits
    return commits.filter((c) => c.subject.toLowerCase().includes(q) || c.hash.toLowerCase().includes(q) || c.short.toLowerCase().includes(q) || c.author.toLowerCase().includes(q))
  }, [commits, filter])

  const selectedCommit = useMemo(() => commits.find((c) => c.hash === selectedHash), [commits, selectedHash])

  const hunks = useMemo(() => parseHunks(diff?.patch || ''), [diff?.patch])
  const diffLines = useMemo(() => hunks.flatMap((h) => h.lines.map((l) => l.text)), [hunks])
  const tokens = useGitLineTokens(diffLines, path)

  const handleCopyHash = useCallback((hash: string) => {
    void navigator.clipboard?.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(''), 1500)
  }, [])

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-canvas">
      {/* Left Pane: Commit History List */}
      <aside className="flex w-72 md:w-80 shrink-0 flex-col border-r border-line bg-panel">
        {/* Search / Filter header */}
        <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
          <div className="relative flex min-w-0 flex-1 items-center">
            <LuSearch className="pointer-events-none absolute left-2 size-3.5 text-ink-soft" aria-hidden />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('git.diff.searchHistoryPlaceholder') || '搜索历史提交…'}
              className="h-6 w-full rounded border border-line bg-canvas/80 pl-7 pr-6 text-xs text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-hidden"
            />
            {filter ? (
              <button type="button" onClick={() => setFilter('')} className="absolute right-1.5 text-ink-soft hover:text-ink cursor-pointer" aria-label={t('common.clear')}>
                <LuX className="size-3" />
              </button>
            ) : null}
          </div>
          <Badge tone="neutral" size="mini" dot={false} className="shrink-0 font-mono text-[10px]">
            {filteredCommits.length}
          </Badge>
        </div>

        {/* Commits list */}
        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-ink-soft">
              <Spinner className="mr-2 size-4" />
              <span className="text-xs">{t('git.diff.loadingHistory') || '正在加载文件历史…'}</span>
            </div>
          ) : error ? (
            <p className="p-4 text-xs text-fail">{error}</p>
          ) : filteredCommits.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-soft">{t('git.diff.noHistoryFound') || '未找到该文件的历史记录'}</div>
          ) : (
            <ul className="flex flex-col gap-0.5 px-1">
              {filteredCommits.map((c) => {
                const isSelected = c.hash === selectedHash
                return (
                  <li
                    key={c.hash}
                    onClick={() => setSelectedHash(c.hash)}
                    className={cn(
                      'group relative flex cursor-pointer flex-col justify-center gap-1 rounded-md px-2.5 py-1.5 transition-colors select-none',
                      isSelected ? 'bg-accent/15 text-ink shadow-xs ring-1 ring-accent/30' : 'text-ink-soft hover:bg-[var(--overlay-08)] hover:text-ink'
                    )}
                  >
                    {/* Line 1: Hash, Committer Author, Relative Time & Locate */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] font-semibold text-accent shrink-0">{c.short || c.hash.slice(0, 7)}</span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-ink min-w-0 truncate" title={c.author}>
                          <LuUser className="size-3 shrink-0 text-ink-soft" />
                          <span className="truncate max-w-[120px]">{c.author || 'Unknown'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-ink-soft/80">{formatCommitAgo(c.date, locale)}</span>
                        <Tooltip content={t('git.diff.locateInGraph') || '在提交图中定位'}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onLocateCommit?.(c.hash)
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-soft hover:text-accent hover:bg-accent/15 cursor-pointer transition-opacity"
                            aria-label={t('git.diff.locateInGraph') || '在提交图中定位'}
                          >
                            <LuCornerDownRight className="size-3" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Line 2: Commit Subject */}
                    <p className="m-0 truncate text-xs text-ink/90 font-normal leading-snug" title={c.subject}>
                      {c.subject}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Right Pane: Selected Commit Diff */}
      <section className="flex flex-1 flex-col overflow-hidden min-w-0 bg-canvas">
        {selectedCommit ? (
          <header className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-panel/40 px-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex items-center gap-1 font-mono font-semibold text-accent">
                <LuGitCommitVertical className="size-3.5" />
                {selectedCommit.short || selectedCommit.hash.slice(0, 7)}
              </span>
              <button type="button" onClick={() => handleCopyHash(selectedCommit.hash)} className="text-ink-soft hover:text-ink cursor-pointer" title="Copy hash">
                {copiedHash === selectedCommit.hash ? <LuCheck className="size-3 text-ok" /> : <LuCopy className="size-3" />}
              </button>
              <span className="text-line-soft">|</span>
              <h3 className="m-0 truncate font-medium text-ink" title={selectedCommit.subject}>
                {selectedCommit.subject}
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-ink-soft">
              <span className="flex items-center gap-1 font-medium text-ink">
                <LuUser className="size-3.5 text-accent" />
                <span>{selectedCommit.author || 'Unknown'}</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <LuClock className="size-3 text-ink-soft" />
                <span>{formatCommitAgo(selectedCommit.date, locale)}</span>
              </span>
              <Tooltip content={t('git.diff.locateInGraph') || '在提交图中定位'}>
                <Button variant="plain" size="mini" onClick={() => onLocateCommit?.(selectedCommit.hash)} className="ml-1">
                  <LuCornerDownRight className="size-3 text-accent" />
                  <span>{t('git.diff.locateInGraph') || '定位'}</span>
                </Button>
              </Tooltip>
            </div>
          </header>
        ) : null}

        {/* Diff content view */}
        <div className="flex-1 overflow-auto min-h-0 font-mono text-xs">
          {diffLoading ? (
            <div className="flex items-center justify-center p-12 text-ink-soft">
              <Spinner className="mr-2 size-4" />
              <span>{t('git.diff.loadingHistory') || '正在加载差异…'}</span>
            </div>
          ) : diffError ? (
            <div className="p-4 text-fail">{diffError}</div>
          ) : !diff?.patch ? (
            <div className="p-8 text-center text-ink-soft">{t('git.diff.noChanges') || '没有内容变更'}</div>
          ) : (
            <div className="min-w-fit divide-y divide-line/30 py-1">
              {hunks.map((hunk, hIdx) => {
                const lineCounter = hunks.slice(0, hIdx).reduce((acc, h) => acc + h.lines.length, 0)
                return (
                  <div key={hIdx} className="mb-2">
                    <div className="bg-canvas/80 px-2 py-0.5 text-[11px] text-accent select-none font-semibold">{hunk.header}</div>
                    {hunk.lines.map((line, lIdx) => {
                      const tokenIdx = lineCounter + lIdx
                      const lineTokens = tokens?.[tokenIdx]
                      return (
                        <div
                          key={lIdx}
                          className={cn(
                            'flex leading-5 transition-colors items-start hover:brightness-95',
                            line.kind === 'add' && 'bg-[#ecfdf5]/85 text-[#064e3b] dark:bg-[#064e3b]/22 dark:text-ink border-l-2 border-emerald-500/70',
                            line.kind === 'del' && 'bg-[#fff1f2]/85 text-[#881337] dark:bg-[#881337]/22 dark:text-ink border-l-2 border-rose-500/70'
                          )}
                        >
                          <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{line.oldNo ?? ''}</span>
                          <span className="w-10 shrink-0 border-r border-line pr-2 text-right text-ink-soft select-none font-mono">{line.newNo ?? ''}</span>
                          <GitDiffCodeText kind={line.kind} text={line.text} tokens={lineTokens} searchNeedle={searchQuery} wrap={wordWrap} />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
