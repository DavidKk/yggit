'use client'

import { getGitDriver } from '@/lib/git/driver'
import { remoteIdentity } from '@/lib/git/project-access'
import type { GitLogView } from '@/lib/git/types'
import { runWithForegroundPriority } from '@/lib/workdesk/scheduler'

interface CachedLogEntry {
  view: GitLogView
  updatedAt: number
}

const MAX_MEMORY_CACHE = 24
const PREFETCH_FRESH_MS = 30_000

const memoryCache = new Map<string, CachedLogEntry>()
const inFlightLoads = new Map<string, Promise<GitLogView>>()

/** Normalize a repo path or remote URL into a canonical cache key. */
export function repoLogCacheKey(repo: string): string {
  const trimmed = repo.trim()
  if (!trimmed) return ''
  const identity = remoteIdentity(trimmed)
  return identity ? `remote:${identity}` : `local:${trimmed}`
}

/** Return true when an unknown error represents an aborted fetch/operation. */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  return error instanceof Error && error.name === 'AbortError'
}

/** Read an in-memory cached GitLogView for the given repo. */
export function getCachedRepoLog(repo: string): CachedLogEntry | null {
  const key = repoLogCacheKey(repo)
  if (!key) return null
  const hit = memoryCache.get(key)
  if (hit) {
    // Refresh LRU order
    memoryCache.delete(key)
    memoryCache.set(key, hit)
    return hit
  }
  return null
}

/** Store a GitLogView in the bounded in-memory LRU cache (never persisted to disk/storage). */
export function setCachedRepoLog(repo: string, view: GitLogView): void {
  const entry: CachedLogEntry = { view, updatedAt: Date.now() }
  const keys = new Set([repoLogCacheKey(repo), repoLogCacheKey(view.repo)].filter(Boolean))
  for (const key of keys) {
    if (memoryCache.has(key)) memoryCache.delete(key)
    else if (memoryCache.size >= MAX_MEMORY_CACHE) {
      const oldest = memoryCache.keys().next().value
      if (oldest) memoryCache.delete(oldest)
    }
    memoryCache.set(key, entry)
  }
}

/** Compare two GitLogView snapshots to avoid redundant UI resets during background revalidation. */
export function hasGitLogViewChanged(prev: GitLogView, next: GitLogView): boolean {
  if (prev.head !== next.head || prev.branch !== next.branch) return true
  if (prev.commits.length !== next.commits.length || prev.branches.length !== next.branches.length) return true
  if (prev.commits[0]?.hash !== next.commits[0]?.hash) return true
  if ((prev.worktree?.files ?? 0) !== (next.worktree?.files ?? 0)) return true
  if ((prev.worktree?.insertions ?? 0) !== (next.worktree?.insertions ?? 0)) return true
  if ((prev.worktree?.deletions ?? 0) !== (next.worktree?.deletions ?? 0)) return true
  return false
}

/** Warm the tree diff cache for the top commit of a repo in the background. */
export function prefetchTopCommitDiff(view: GitLogView): void {
  const topHash = view.commits[0]?.hash
  if (!topHash || !view.repo) return
  try {
    const driver = getGitDriver()
    void driver.readCommitDiff({ repo: view.repo, hash: topHash, tree: true }).catch(() => {})
  } catch {
    // Ignore prefetch errors
  }
}

/** Load a repo's log with per-repo in-flight deduplication and cache updates. */
export async function fetchRepoLogDeduplicated(repo: string, options: { locate?: string; signal?: AbortSignal; onProgress?: (stage: string) => void } = {}): Promise<GitLogView> {
  const key = repoLogCacheKey(repo)
  const canShareInFlight = !options.locate && !options.signal && Boolean(key)
  if (canShareInFlight && inFlightLoads.has(key)) {
    return inFlightLoads.get(key)!
  }
  const driver = getGitDriver()
  const promise = runWithForegroundPriority(() => driver.readLog({ repo, locate: options.locate, signal: options.signal, onProgress: options.onProgress }))
    .then((view) => {
      if (!options.locate) {
        setCachedRepoLog(repo, view)
      }
      return view
    })
    .finally(() => {
      if (canShareInFlight && inFlightLoads.get(key) === promise) {
        inFlightLoads.delete(key)
      }
    })
  if (canShareInFlight) {
    inFlightLoads.set(key, promise)
  }
  return promise
}

/** Silently prefetch a remote repo's log and top commit diff if not recently cached. */
export function prefetchRepoLog(repo: string): void {
  const key = repoLogCacheKey(repo)
  if (!key || inFlightLoads.has(key)) return
  const cached = getCachedRepoLog(repo)
  if (cached && Date.now() - cached.updatedAt < PREFETCH_FRESH_MS) return
  void fetchRepoLogDeduplicated(repo)
    .then((view) => {
      prefetchTopCommitDiff(view)
    })
    .catch(() => {
      // Ignore background prefetch errors
    })
}

/** Clear all cached repo logs (primarily for tests). */
export function clearRepoLogCache(): void {
  memoryCache.clear()
  inFlightLoads.clear()
}
