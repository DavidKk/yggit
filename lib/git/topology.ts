import type { GitCommit } from '@/lib/git/types'

export interface MergeTopologyInfo {
  isMerge: boolean
  targetBranchHint?: string
  sourceBranchHint?: string
  prNumber?: number
  parent1Hash?: string
  parent2Hash?: string
  mergeBaseHash?: string
  commitsIncluded: string[]
  highlightHashes: string[]
}

/**
 * Extracts branch intent from conventional merge commit messages.
 * Examples:
 * - "Merge branch 'feature/pay' into main"
 * - "Merge remote-tracking branch 'origin/feature/pay' into test"
 * - "Merge pull request #42 from org/feature/pay"
 */
export function parseBranchIntents(subject: string): { source?: string; target?: string; pr?: number } {
  if (!subject) return {}

  // 1. "Merge pull request #123 from org/feature/pay"
  const prMatch = subject.match(/Merge pull request #(\d+)(?: from ([^\s\n]+))?/i)
  if (prMatch) {
    const pr = parseInt(prMatch[1], 10)
    let source = prMatch[2]
    if (source && source.includes('/')) {
      source = source.split('/').slice(1).join('/')
    }
    return { pr, source }
  }

  // 2. "Merge branch 'feature/pay' into main" or "Merge remote-tracking branch 'origin/feature/pay' into test"
  const branchMatch = subject.match(/Merge (?:remote-tracking )?branch '([^']+)'(?: into ([^\s\n]+))?/i)
  if (branchMatch) {
    let source = branchMatch[1]
    if (source.startsWith('origin/')) {
      source = source.slice('origin/'.length)
    }
    const target = branchMatch[2]?.replace(/^['"]|['"]$/g, '')
    return { source, target }
  }

  return {}
}

/**
 * Analyzes a merge commit, identifying Parent 1 (Target / Main) and Parent 2 (Source / Feature),
 * calculating the commits introduced by the merged feature branch.
 */
export function analyzeMergeTopology(commit: GitCommit, commitMap?: Map<string, GitCommit>): MergeTopologyInfo {
  if (!commit || !commit.parents || commit.parents.length < 2) {
    return {
      isMerge: false,
      commitsIncluded: [],
      highlightHashes: [],
    }
  }

  const p1 = commit.parents[0] // Target branch tip before merge
  const p2 = commit.parents[1] // Source feature branch tip before merge
  const intents = parseBranchIntents(commit.subject)

  const info: MergeTopologyInfo = {
    isMerge: true,
    parent1Hash: p1,
    parent2Hash: p2,
    targetBranchHint: intents.target,
    sourceBranchHint: intents.source,
    prNumber: intents.pr,
    commitsIncluded: [],
    highlightHashes: [],
  }

  if (!commitMap) {
    return info
  }

  // Trace commits reachable from p2, stopping when reaching p1 or descendants of p1
  const p1Ancestors = new Set<string>()
  const queue1 = [p1]
  const visited1 = new Set<string>([p1])

  // Bound traversal by the loaded graph rather than an arbitrary depth.
  while (queue1.length > 0) {
    const curr = queue1.shift()!
    p1Ancestors.add(curr)
    const node = commitMap.get(curr)
    if (node?.parents) {
      for (const parent of node.parents) {
        if (!visited1.has(parent)) {
          visited1.add(parent)
          queue1.push(parent)
        }
      }
    }
  }

  // Trace P2 lineage not in P1
  const included: string[] = []
  const queue2 = [p2]
  const visited2 = new Set<string>([p2])
  let mergeBase: string | undefined

  while (queue2.length > 0) {
    const curr = queue2.shift()!
    if (p1Ancestors.has(curr)) {
      if (!mergeBase) mergeBase = curr
      continue
    }
    included.push(curr)
    const node = commitMap.get(curr)
    if (node?.parents) {
      for (const parent of node.parents) {
        if (!visited2.has(parent)) {
          visited2.add(parent)
          queue2.push(parent)
        }
      }
    }
  }

  // Include both sides up to their shared ancestry, plus the merge itself.
  const sourceAncestors = new Set<string>()
  const sourceQueue = [p2]
  while (sourceQueue.length) {
    const hash = sourceQueue.pop()!
    if (sourceAncestors.has(hash)) continue
    sourceAncestors.add(hash)
    sourceQueue.push(...(commitMap.get(hash)?.parents ?? []))
  }
  const highlighted = new Set([commit.hash, ...included])
  const targetQueue = [p1]
  const targetVisited = new Set<string>()
  while (targetQueue.length) {
    const hash = targetQueue.pop()!
    if (targetVisited.has(hash)) continue
    targetVisited.add(hash)
    highlighted.add(hash)
    if (!sourceAncestors.has(hash)) targetQueue.push(...(commitMap.get(hash)?.parents ?? []))
  }
  for (const hash of visited2) if (p1Ancestors.has(hash)) highlighted.add(hash)
  info.highlightHashes = [...highlighted]
  info.commitsIncluded = included
  info.mergeBaseHash = mergeBase

  return info
}

/**
 * Traces all commits belonging to a branch by starting at the branch's tip ref(s)
 * and traversing back through parent commits.
 */
export function getBranchCommitHashes(branchName: string, commits: GitCommit[]): Set<string> {
  const result = new Set<string>()
  if (!branchName || commits.length === 0) return result

  const cleanName = branchName
    .replace(/^refs\/(heads|remotes)\//, '')
    .replace(/^HEAD -> /, '')
    .trim()
  const startHashes: string[] = []

  for (const commit of commits) {
    if (
      commit.refs.some(
        (r) => r === cleanName || r === `HEAD -> ${cleanName}` || r === `refs/heads/${cleanName}` || r === `refs/remotes/${cleanName}` || r.endsWith(`/${cleanName}`)
      )
    ) {
      startHashes.push(commit.hash)
    }
  }

  if (startHashes.length === 0) {
    return result
  }

  const commitMap = new Map<string, GitCommit>()
  for (const c of commits) commitMap.set(c.hash, c)

  const queue = [...startHashes]
  while (queue.length > 0) {
    const hash = queue.shift()!
    if (result.has(hash)) continue
    result.add(hash)
    const commit = commitMap.get(hash)
    if (commit?.parents) {
      for (const parent of commit.parents) {
        if (!result.has(parent) && commitMap.has(parent)) {
          queue.push(parent)
        }
      }
    }
  }

  return result
}
