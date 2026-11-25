import type { GitCommit, GitLogView } from '@/lib/git/types'

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function isCommitEquivalent(a: GitCommit, b: GitCommit): boolean {
  if (a === b) return true
  if (a.hash !== b.hash || a.subject !== b.subject) return false
  return areStringArraysEqual(a.refs, b.refs)
}

export function areCommitListsEquivalent(a: GitCommit[], b: GitCommit[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!isCommitEquivalent(a[i], b[i])) return false
  }
  return true
}

/**
 * Reconciles refreshed commits against the previous array while preserving exact object references
 * for unchanged commits (preventing downstream selection/file-panel re-renders).
 */
export function reconcileCommitsPreservingRefs(prev: GitCommit[], next: GitCommit[]): GitCommit[] {
  if (areCommitListsEquivalent(prev, next)) return prev
  const prevByHash = new Map<string, GitCommit>()
  for (const commit of prev) {
    prevByHash.set(commit.hash, commit)
  }
  let allSameRef = prev.length === next.length
  const merged = next.map((item, idx) => {
    const existing = prevByHash.get(item.hash)
    if (existing && isCommitEquivalent(existing, item)) {
      if (prev[idx] !== existing) allSameRef = false
      return existing
    }
    allSameRef = false
    return item
  })
  return allSameRef ? prev : merged
}

export function hasGitLogViewMetadataChanged(prev: GitLogView, next: GitLogView): boolean {
  if (prev.head !== next.head || prev.branch !== next.branch) return true
  if (JSON.stringify(prev.worktree ?? null) !== JSON.stringify(next.worktree ?? null)) return true
  if (JSON.stringify(prev.branches) !== JSON.stringify(next.branches)) return true
  if (JSON.stringify(prev.remotes) !== JSON.stringify(next.remotes)) return true
  if (JSON.stringify(prev.tags) !== JSON.stringify(next.tags)) return true
  if (JSON.stringify(prev.stashes) !== JSON.stringify(next.stashes)) return true
  if (JSON.stringify(prev.worktrees) !== JSON.stringify(next.worktrees)) return true
  if (JSON.stringify(prev.submodules) !== JSON.stringify(next.submodules)) return true
  if (JSON.stringify(prev.marks) !== JSON.stringify(next.marks)) return true
  return false
}
