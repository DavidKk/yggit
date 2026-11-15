'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronDown, LuChevronUp, LuX } from 'react-icons/lu'

import { useGitUiDebugHoldExploreLoading } from '@/components/git/git-ui-debug'
import { GitExploreStrip } from '@/components/git/GitExploreStrip'
import { GIT_FIND_EVENT } from '@/components/git/gitFind'
import { GitGraph } from '@/components/git/GitGraph'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, TextInput } from '@/components/sk'
import { type GitCommit, type GitStash, gitStashAsCommit, type GitWorktree } from '@/lib/git/types'

type Props = {
  repo: string
  remoteUrl?: string
  scope: string
  commits: GitCommit[]
  hasMore: boolean
  worktree: GitWorktree | null
  stashes?: GitStash[]
  highlight: string
  lineageHashes?: Set<string> | null
  remoteNames?: string[]
  worktreeBranches?: string[]
  selectedHash?: string
  focusRequest?: { hash: string } | null
  onSelect?: (commit: GitCommit) => void
  onSelectWorktree?: () => void
  onPage: (scope: string, commits: GitCommit[], hasMore: boolean) => void
}

function commitMatches(commit: GitCommit, needle: string) {
  if (!needle) return true
  const hay = `${commit.subject}\n${commit.author}\n${commit.hash}\n${commit.refs.join('\n')}`.toLowerCase()
  return hay.includes(needle)
}

function stashMatches(stash: GitStash, needle: string) {
  if (!needle) return true
  const hay = `${stash.subject}\n${stash.name}\n${stash.hash}`.toLowerCase()
  return hay.includes(needle)
}

export function GitHistory({
  repo,
  remoteUrl,
  scope,
  commits,
  hasMore,
  worktree,
  stashes,
  highlight,
  lineageHashes,
  remoteNames,
  worktreeBranches,
  selectedHash,
  focusRequest,
  onSelect,
  onSelectWorktree,
  onPage,
}: Props) {
  const t = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef(false)
  const focusedRequestRef = useRef<Props['focusRequest']>(null)
  const stateRef = useRef({ repo, scope, commits, hasMore })
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [findOpen, setFindOpen] = useState(false)
  const holdExplore = useGitUiDebugHoldExploreLoading()
  stateRef.current = { repo, scope, commits, hasMore }

  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!needle) return []
    const stashHits = (stashes || []).filter((stash) => stashMatches(stash, needle)).map(gitStashAsCommit)
    const commitHits = commits.filter((commit) => commitMatches(commit, needle))
    return stashHits.concat(commitHits)
  }, [commits, needle, stashes])
  const showFind = findOpen || Boolean(needle)
  const matchPos =
    needle && matches.length > 0
      ? Math.max(
          0,
          matches.findIndex((commit) => commit.hash === selectedHash)
        )
      : -1
  const showExplore = loading || holdExplore

  const loadMore = useCallback(() => {
    const current = stateRef.current
    if (lockRef.current || !current.hasMore || !current.repo || !current.scope) return
    lockRef.current = true
    setLoading(true)
    const params = new URLSearchParams({ repo: current.repo, ref: current.scope, skip: String(current.commits.length) })
    void fetch(`/api/git/log?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as { ok?: boolean; commits?: GitCommit[]; hasMore?: boolean }
        if (!response.ok || body.ok === false || !body.commits) return
        if (stateRef.current.repo !== current.repo || stateRef.current.scope !== current.scope) return
        const seen = new Set(current.commits.map((commit) => commit.hash))
        const next = current.commits.concat(body.commits.filter((commit) => !seen.has(commit.hash)))
        onPage(current.scope, next, body.hasMore === true)
      })
      .finally(() => {
        lockRef.current = false
        setLoading(false)
      })
  }, [onPage])

  useEffect(() => {
    if (!focusRequest?.hash || focusedRequestRef.current === focusRequest) return
    const root = rootRef.current
    if (!root) return
    const hash = CSS.escape(focusRequest.hash)
    const row = root.querySelector<HTMLElement>(`[data-git-commit-hash="${hash}"]`)
    if (!row) {
      if (hasMore) loadMore()
      return
    }
    focusedRequestRef.current = focusRequest
    const bounds = root.getBoundingClientRect()
    const target = row.getBoundingClientRect()
    root.scrollTop += target.top - bounds.top - (root.clientHeight - target.height) / 2
    const pan = root.querySelector<HTMLElement>('[data-git-graph-pan]')
    const node = root.querySelector<HTMLElement>(`[data-git-node-hash="${hash}"]`)
    if (pan && node) {
      const viewport = pan.getBoundingClientRect()
      const dot = node.getBoundingClientRect()
      if (dot.left < viewport.left || dot.right > viewport.right) {
        pan.scrollLeft += (dot.left + dot.right - viewport.left - viewport.right) / 2
      }
    }
    row.focus({ preventScroll: true })
  }, [repo, focusRequest, commits, stashes, hasMore, loadMore])

  useEffect(() => {
    const root = rootRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { root, rootMargin: '120px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore, commits.length])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    function onFind() {
      setFindOpen(true)
      window.requestAnimationFrame(() => findInputRef.current?.focus({ preventScroll: true }))
    }
    panel.addEventListener(GIT_FIND_EVENT, onFind)
    return () => panel.removeEventListener(GIT_FIND_EVENT, onFind)
  }, [])

  function closeFind() {
    setQuery('')
    setFindOpen(false)
    panelRef.current?.focus()
  }

  function stepMatch(delta: number) {
    if (matches.length === 0) return
    const current = matchPos >= 0 ? matchPos : delta > 0 ? -1 : 0
    const next = (current + delta + matches.length) % matches.length
    const commit = matches[next]
    if (commit) onSelect?.(commit)
  }

  useEffect(() => {
    if (!showFind) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (query) setQuery('')
        closeFind()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'g') {
        event.preventDefault()
        stepMatch(event.shiftKey ? -1 : 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showFind, query, matches, matchPos])

  useEffect(() => {
    if (!needle || matches.length === 0) return
    if (matchPos >= 0) return
    onSelect?.(matches[0])
  }, [needle, matches, matchPos, onSelect])

  useEffect(() => {
    if (!showFind || !selectedHash) return
    const root = rootRef.current
    if (!root) return
    const row = root.querySelector(`[data-git-commit-hash="${CSS.escape(selectedHash)}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [showFind, selectedHash])

  return (
    <div ref={panelRef} data-git-find="history" tabIndex={-1} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none">
      {showFind ? (
        <div
          role="search"
          className="absolute top-2 right-2 z-30 flex max-w-[min(100%-1rem,24rem)] items-center overflow-hidden rounded-md border border-[color-mix(in_oklab,var(--focus-contrast-border)_100%,transparent)] bg-[color-mix(in_oklab,var(--focus-contrast)_14%,var(--panel))] shadow-[0_8px_24px_rgb(0_0_0/0.35),0_0_0_1px_color-mix(in_oklab,var(--focus-contrast)_25%,transparent)]"
        >
          <TextInput
            ref={findInputRef}
            search
            clearable
            aria-label={t('git.history.findCommit')}
            placeholder={t('git.history.findCommit')}
            value={query}
            className="min-w-[10rem] flex-1 border-transparent bg-transparent shadow-none focus-within:border-transparent"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                stepMatch(event.shiftKey ? -1 : 1)
              }
            }}
          />
          <div className="flex shrink-0 items-center gap-0.5 self-stretch border-l border-[color-mix(in_oklab,var(--focus-contrast)_35%,transparent)] bg-[color-mix(in_oklab,var(--focus-contrast)_22%,transparent)] px-1">
            <span className="shrink-0 px-1 text-[0.6875rem] whitespace-nowrap text-focus-contrast-ink tabular-nums" aria-live="polite">
              {needle ? (matches.length === 0 ? t('git.history.findZero') : `${(matchPos >= 0 ? matchPos : 0) + 1}/${matches.length}`) : '—'}
            </span>
            <Button
              variant="plain"
              size="icon"
              className="size-6 shrink-0 text-focus-contrast-ink hover:enabled:bg-[rgb(255_255_255/0.12)] hover:enabled:text-focus-contrast-ink"
              aria-label={t('git.history.prev')}
              disabled={matches.length === 0}
              onClick={() => stepMatch(-1)}
            >
              <LuChevronUp className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="plain"
              size="icon"
              className="size-6 shrink-0 text-focus-contrast-ink hover:enabled:bg-[rgb(255_255_255/0.12)] hover:enabled:text-focus-contrast-ink"
              aria-label={t('git.history.next')}
              disabled={matches.length === 0}
              onClick={() => stepMatch(1)}
            >
              <LuChevronDown className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="plain"
              size="icon"
              className="size-6 shrink-0 text-focus-contrast-ink hover:enabled:bg-[rgb(255_255_255/0.12)] hover:enabled:text-focus-contrast-ink"
              aria-label={t('git.history.closeFind')}
              onClick={closeFind}
            >
              <LuX className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
      <GitGraph
        repo={repo}
        remoteUrl={remoteUrl}
        commits={commits}
        worktree={worktree}
        stashes={stashes}
        highlight={highlight}
        lineageHashes={lineageHashes}
        remoteNames={remoteNames}
        worktreeBranches={worktreeBranches}
        selectedHash={selectedHash}
        findNeedle={needle}
        scrollRef={rootRef}
        footer={hasMore ? <div ref={sentinelRef} className="h-px" aria-hidden /> : null}
        onSelect={onSelect}
        onSelectWorktree={onSelectWorktree}
      />
      {showExplore ? <GitExploreStrip className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-panel/95 py-0.5" /> : null}
    </div>
  )
}
