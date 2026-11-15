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
    const target = branchMatch[2]
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
  }

  if (!commitMap) {
    return info
  }

  // Trace commits reachable from p2, stopping when reaching p1 or descendants of p1
  const p1Ancestors = new Set<string>()
  const queue1 = [p1]
  const visited1 = new Set<string>([p1])

  // Collect reasonable depth of P1 ancestors (e.g. up to 100 commits)
  while (queue1.length > 0 && visited1.size < 100) {
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

  while (queue2.length > 0 && included.length < 80) {
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

  info.commitsIncluded = included
  info.mergeBaseHash = mergeBase

  return info
}
