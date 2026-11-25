'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useGitUiDebugHoldExploreLoading } from '@/components/git/git-ui-debug'
import { GitExploreStrip } from '@/components/git/GitExploreStrip'
import { GIT_FIND_EVENT } from '@/components/git/gitFind'
import { GitFindBox } from '@/components/git/GitFindBox'
import { GitGraph } from '@/components/git/GitGraph'
import { useT } from '@/components/i18n/LocaleProvider'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { getGitDriver } from '@/lib/git/driver'
import { type GitCommit, type GitStash, gitStashAsCommit, type GitWorktree } from '@/lib/git/types'

type Props = {
  repo: string
  remoteUrl?: string
  scope: string
  commits: GitCommit[]
  hasMore: boolean
  hasPrev?: boolean
  startIndex?: number
  worktree: GitWorktree | null
  stashes?: GitStash[]
  highlight: string
  lineageHashes?: Set<string> | null
  remoteNames?: string[]
  worktreeBranches?: string[]
  selectedHash?: string
  conflicts?: Record<string, MergeConflictRecord>
  scrollRef?: React.RefObject<HTMLDivElement | null>
  focusRequest?: { hash: string } | null
  activeHoverBranch?: string | null
  onBranchHoverStart?: (branchName: string) => void
  onBranchHoverEnd?: () => void
  onSelect?: (commit: GitCommit) => void
  onSelectWorktree?: () => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => void
  onPushBranch?: (branch: string) => Promise<void> | void
  onPullBranch?: (branch: string) => Promise<void> | void
  onCreateBranch?: (branch: string, startPoint?: string) => Promise<void> | void
  onDeleteBranch?: (branch: string) => Promise<void> | void
  onRenameBranch?: (oldName: string) => Promise<void> | void
  onOpenConflictView?: (hash: string, file?: string) => void
  onPage: (scope: string, commits: GitCommit[], hasMore: boolean, hasPrev?: boolean, startIndex?: number) => void
  onPagePrepend?: (commits: GitCommit[], hasPrev: boolean, startIndex: number) => void
  onRefresh?: () => Promise<void> | void
  currentBranch?: string
  soloBranch?: string | null
  onSoloBranch?: (branch: string | null) => void
  soloRemote?: string | null
  hiddenRemotes?: string[]
}

function commitMatches(commit: GitCommit, needle: string) {
  if (!needle) return true
  const terms = needle.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const hay = [commit.hash, commit.short, commit.subject, commit.author, commit.date, ...(commit.refs || [])].join(' ').toLowerCase()

  return terms.every((term) => {
    const clean = term.replace(/^#/, '')
    return hay.includes(clean)
  })
}

function stashMatches(stash: GitStash, needle: string) {
  if (!needle) return true
  const terms = needle.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const hay = [stash.hash, stash.name, stash.subject, stash.date || ''].join(' ').toLowerCase()
  return terms.every((term) => {
    const clean = term.replace(/^#/, '')
    return hay.includes(clean)
  })
}

export function GitHistory({
  repo,
  remoteUrl,
  scope,
  commits,
  hasMore,
  hasPrev,
  startIndex,
  worktree,
  stashes,
  highlight,
  lineageHashes,
  remoteNames,
  worktreeBranches,
  selectedHash,
  conflicts,
  scrollRef,
  focusRequest,
  activeHoverBranch,
  onBranchHoverStart,
  onBranchHoverEnd,
  onSelect,
  onSelectWorktree,
  onCheckoutBranch,
  onPushBranch,
  onPullBranch,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  onOpenConflictView,
  onPage,
  onPagePrepend,
  onRefresh,
  currentBranch,
  soloBranch,
  onSoloBranch,
  soloRemote,
  hiddenRemotes,
}: Props) {
  const t = useT()
  const internalRootRef = useRef<HTMLDivElement>(null)
  const rootRef = (scrollRef as React.RefObject<HTMLDivElement>) || internalRootRef
  const rootRefHolder = useRef(rootRef)
  rootRefHolder.current = rootRef
  const panelRef = useRef<HTMLDivElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef(false)
  const lastRequestedSkipRef = useRef<number>(-1)
  const focusedRequestRef = useRef<Props['focusRequest']>(null)
  const stateRef = useRef({ repo, scope, commits, hasMore, hasPrev, startIndex })
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [findOpen, setFindOpen] = useState(false)
  const [gitMatches, setGitMatches] = useState<GitCommit[]>([])
  const [isSearchingGit, setIsSearchingGit] = useState(false)

  useEffect(() => {
    setQuery('')
    setFindOpen(false)
    setGitMatches([])
    setIsSearchingGit(false)
    lastRequestedSkipRef.current = -1
  }, [repo, scope])

  useEffect(() => {
    function onClearSearches() {
      setQuery('')
      setFindOpen(false)
      setGitMatches([])
      setIsSearchingGit(false)
    }
    window.addEventListener('yggit:clear_searches', onClearSearches)
    return () => window.removeEventListener('yggit:clear_searches', onClearSearches)
  }, [])
  const holdExplore = useGitUiDebugHoldExploreLoading()
  stateRef.current = { repo, scope, commits, hasMore, hasPrev, startIndex }

  const needle = query.trim().toLowerCase()

  // Deep search in Git when search needle is >= 2 chars
  useEffect(() => {
    if (!needle || needle.length < 2 || !repo) {
      setGitMatches([])
      setIsSearchingGit(false)
      return
    }

    let active = true
    setIsSearchingGit(true)

    const timer = setTimeout(() => {
      const driver = getGitDriver()
      if (!driver.searchLog) {
        setIsSearchingGit(false)
        return
      }

      driver
        .searchLog({
          repo,
          ref: scope,
          query: needle,
          limit: 50,
        })
        .then((res) => {
          if (!active) return
          const seen = new Set(commits.map((c) => c.hash))
          const remoteHits = (res.commits || []).filter((c) => !seen.has(c.hash))
          setGitMatches(remoteHits)
        })
        .catch(() => {
          if (active) setGitMatches([])
        })
        .finally(() => {
          if (active) setIsSearchingGit(false)
        })
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [needle, repo, scope, commits])

  const matches = useMemo(() => {
    if (!needle) return []
    const stashHits = (stashes || []).filter((stash) => stashMatches(stash, needle)).map(gitStashAsCommit)
    const commitHits = commits.filter((commit) => commitMatches(commit, needle))
    const localHits = stashHits.concat(commitHits)
    const seen = new Set(localHits.map((c) => c.hash))
    const extraHits = gitMatches.filter((c) => !seen.has(c.hash))
    return localHits.concat(extraHits)
  }, [commits, gitMatches, needle, stashes])
  const showFind = findOpen || Boolean(needle)
  const matchPos =
    needle && matches.length > 0
      ? Math.max(
          0,
          matches.findIndex((commit) => commit.hash === selectedHash)
        )
      : -1
  const showFooterLoading = loading || holdExplore

  const loadMore = useCallback(() => {
    const current = stateRef.current
    const skipOffset = (current.startIndex ?? 0) + current.commits.length
    if (lockRef.current || !current.hasMore || !current.repo || !current.scope) return
    if (lastRequestedSkipRef.current === skipOffset) return
    lockRef.current = true
    lastRequestedSkipRef.current = skipOffset
    setLoading(true)
    const startTime = Date.now()
    const driver = getGitDriver()
    driver
      .readLog({
        repo: current.repo,
        ref: current.scope,
        skip: skipOffset,
      })
      .then((body) => {
        if (!body || !body.commits) return
        if (stateRef.current.repo !== current.repo || stateRef.current.scope !== current.scope) return
        const seen = new Set(current.commits.map((commit) => commit.hash))
        const next = current.commits.concat(body.commits.filter((commit) => !seen.has(commit.hash)))
        onPage(current.scope, next, body.hasMore === true)
      })
      .catch(() => {
        lastRequestedSkipRef.current = -1
      })
      .finally(() => {
        const elapsed = Date.now() - startTime
        const delay = Math.max(0, 260 - elapsed)
        setTimeout(() => {
          lockRef.current = false
          setLoading(false)
        }, delay)
      })
  }, [onPage])

  const loadPrev = useCallback(() => {
    const current = stateRef.current
    const curStartIndex = current.startIndex ?? 0
    if (lockRef.current || !current.hasPrev || curStartIndex <= 0 || !current.repo || !current.scope) return
    lockRef.current = true
    setLoading(true)
    const take = Math.min(50, curStartIndex)
    const newSkip = curStartIndex - take
    const root = rootRefHolder.current.current
    const prevScrollTop = root?.scrollTop ?? 0
    const startTime = Date.now()
    const driver = getGitDriver()

    driver
      .readLog({
        repo: current.repo,
        ref: current.scope,
        skip: newSkip,
        take,
      })
      .then((body) => {
        if (!body || !body.commits || body.commits.length === 0) return
        if (stateRef.current.repo !== current.repo || stateRef.current.scope !== current.scope) return
        onPagePrepend?.(body.commits, newSkip > 0, newSkip)
        requestAnimationFrame(() => {
          const r = rootRefHolder.current.current
          if (r) {
            r.scrollTop = prevScrollTop + body.commits.length * 26
          }
        })
      })
      .catch(() => {})
      .finally(() => {
        const elapsed = Date.now() - startTime
        const delay = Math.max(0, 320 - elapsed)
        setTimeout(() => {
          lockRef.current = false
          setLoading(false)
        }, delay)
      })
  }, [onPagePrepend])

  useEffect(() => {
    if (!focusRequest?.hash || focusedRequestRef.current === focusRequest) return
    const root = rootRef.current
    if (!root) return
    const targetHash = focusRequest.hash.trim().toLowerCase()
    const targetCommit = commits.find((c) => c.hash.toLowerCase() === targetHash || c.short.toLowerCase() === targetHash || c.hash.toLowerCase().startsWith(targetHash))
    const fullHash = targetCommit ? targetCommit.hash : focusRequest.hash

    const safeHash = CSS.escape(fullHash)
    const row = root.querySelector<HTMLElement>(`[data-git-commit-hash="${safeHash}"]`) || root.querySelector<HTMLElement>(`[data-git-commit-hash^="${CSS.escape(targetHash)}"]`)
    if (!row) {
      if (hasMore) loadMore()
      return
    }
    focusedRequestRef.current = focusRequest
    requestAnimationFrame(() => {
      const bounds = root.getBoundingClientRect()
      const target = row.getBoundingClientRect()
      if (bounds.height > 0 && target.height > 0) {
        root.scrollTop += target.top - bounds.top - (root.clientHeight - target.height) / 2
      }
      const pan = root.querySelector<HTMLElement>('[data-git-graph-pan]')
      const node = root.querySelector<HTMLElement>(`[data-git-node-hash="${safeHash}"]`) || root.querySelector<HTMLElement>(`[data-git-node-hash^="${CSS.escape(targetHash)}"]`)
      if (pan && node) {
        const viewport = pan.getBoundingClientRect()
        const dot = node.getBoundingClientRect()
        if (dot.left < viewport.left || dot.right > viewport.right) {
          pan.scrollLeft += (dot.left + dot.right - viewport.left - viewport.right) / 2
        }
      }
      // Only transfer focus if the user was not interacting with the sidebar or file tree
      const active = typeof document !== 'undefined' ? document.activeElement : null
      if (!active?.closest?.('[data-git-sidebar]') && !active?.closest?.('[data-git-tree]')) {
        row.focus({ preventScroll: true })
      }
    })
  }, [repo, focusRequest, commits, stashes, hasMore, loadMore, rootRef])

  useEffect(() => {
    const root = rootRef.current
    const sentinel = sentinelRef.current
    const topSentinel = topSentinelRef.current
    if (!root) return

    let bottomObserver: IntersectionObserver | null = null
    let wasBottomIntersecting = false
    if (sentinel && hasMore) {
      bottomObserver = new IntersectionObserver(
        (entries) => {
          const isNow = entries.some((entry) => entry.isIntersecting)
          if (isNow && !wasBottomIntersecting) {
            loadMore()
          }
          wasBottomIntersecting = isNow
        },
        { root, rootMargin: '40px' }
      )
      bottomObserver.observe(sentinel)
    }

    let topObserver: IntersectionObserver | null = null
    if (topSentinel && hasPrev) {
      topObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) loadPrev()
        },
        { root, rootMargin: '120px' }
      )
      topObserver.observe(topSentinel)
    }

    // Passive scroll listener: triggers fallback loadMore / loadPrev without mutating React state during scroll
    const onScroll = () => {
      if (lockRef.current) return
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight
      if (remaining <= 48 && stateRef.current.hasMore) {
        loadMore()
      } else if (root.scrollTop <= 120 && stateRef.current.hasPrev && (stateRef.current.startIndex ?? 0) > 0) {
        loadPrev()
      }
    }
    root.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      bottomObserver?.disconnect()
      topObserver?.disconnect()
      root.removeEventListener('scroll', onScroll)
    }
  }, [hasMore, hasPrev, loadMore, loadPrev, rootRef])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    function onFind() {
      setFindOpen(true)
      window.requestAnimationFrame(() => {
        findInputRef.current?.focus({ preventScroll: true })
        findInputRef.current?.select()
      })
    }
    panel.addEventListener(GIT_FIND_EVENT, onFind)
    return () => panel.removeEventListener(GIT_FIND_EVENT, onFind)
  }, [])

  function closeFind() {
    setQuery('')
    setFindOpen(false)
    panelRef.current?.focus()
  }

  const handleSelectMatch = useCallback(
    (commit: GitCommit) => {
      onSelect?.(commit)
      const isInWindow = commits.some((c) => c.hash === commit.hash)
      if (!isInWindow && repo) {
        const driver = getGitDriver()
        driver
          .readLog({
            repo,
            ref: scope,
            locate: commit.hash,
            take: 50,
          })
          .then((body) => {
            if (!body || !body.commits || body.commits.length === 0) return
            onPage(scope, body.commits, body.hasMore === true, body.hasPrev, body.startIndex)
          })
          .catch(() => {})
      }
    },
    [commits, onPage, onSelect, repo, scope]
  )

  function stepMatch(delta: number) {
    if (matches.length === 0) return
    const current = matchPos >= 0 ? matchPos : delta > 0 ? -1 : 0
    const next = (current + delta + matches.length) % matches.length
    const commit = matches[next]
    if (commit) handleSelectMatch(commit)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFind, query, matches, matchPos])

  useEffect(() => {
    if (!needle || matches.length === 0) return
    if (matchPos >= 0) return
    handleSelectMatch(matches[0])
  }, [needle, matches, matchPos, handleSelectMatch])

  useEffect(() => {
    if (!showFind || !selectedHash) return
    const root = rootRef.current
    if (!root) return
    const row = root.querySelector(`[data-git-commit-hash="${CSS.escape(selectedHash)}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [showFind, selectedHash, rootRef])

  return (
    <div ref={panelRef} data-git-find="history" tabIndex={-1} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none">
      {showFind ? (
        <div className="absolute top-2 right-2 z-30">
          <GitFindBox
            inputRef={findInputRef}
            value={query}
            onChange={setQuery}
            onClose={closeFind}
            onPrev={() => stepMatch(-1)}
            onNext={() => stepMatch(1)}
            current={matchPos}
            total={matches.length}
            loading={isSearchingGit}
            placeholder={t('git.history.findCommit') || '搜索提交、作者或 Hash…'}
            ariaLabel={t('git.history.findCommit')}
          />
        </div>
      ) : null}
      <GitGraph
        repo={repo}
        remoteUrl={remoteUrl}
        commits={commits}
        conflicts={conflicts}
        worktree={startIndex === 0 || !startIndex ? worktree : null}
        stashes={stashes}
        highlight={highlight}
        lineageHashes={lineageHashes}
        remoteNames={remoteNames}
        worktreeBranches={worktreeBranches}
        selectedHash={selectedHash}
        activeHoverBranch={activeHoverBranch}
        onBranchHoverStart={onBranchHoverStart}
        onBranchHoverEnd={onBranchHoverEnd}
        findNeedle={needle}
        scrollRef={rootRef}
        header={hasPrev ? <div ref={topSentinelRef} className="h-px" aria-hidden /> : null}
        footer={
          hasMore ? (
            <div ref={sentinelRef} className="flex min-h-[56px] w-full items-center justify-center">
              {showFooterLoading ? <GitExploreStrip className="w-full py-1" /> : null}
            </div>
          ) : commits.length > 0 ? (
            <div
              className="flex min-h-[56px] w-full items-center justify-center gap-3 border-t border-[color-mix(in_oklab,var(--ink)_10%,transparent)] px-6 text-xs text-ink-soft select-none"
              role="status"
            >
              <span className="h-px max-w-16 flex-1 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" aria-hidden />
              <span className="font-medium tracking-wide">{t('git.history.allLoaded')}</span>
              <span className="h-px max-w-16 flex-1 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" aria-hidden />
            </div>
          ) : null
        }
        onSelect={onSelect}
        onSelectWorktree={onSelectWorktree}
        onCheckoutBranch={onCheckoutBranch}
        onPushBranch={onPushBranch}
        onPullBranch={onPullBranch}
        onCreateBranch={onCreateBranch}
        onDeleteBranch={onDeleteBranch}
        onRenameBranch={onRenameBranch}
        onOpenConflictView={onOpenConflictView}
        onRefresh={onRefresh}
        currentBranch={currentBranch}
        soloBranch={soloBranch}
        onSoloBranch={onSoloBranch}
        soloRemote={soloRemote}
        hiddenRemotes={hiddenRemotes}
      />
    </div>
  )
}
