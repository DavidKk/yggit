import type { GitCommit, GitLogView, GitSelection } from '@/lib/git/types'

export interface GitHistorySegment {
  id: string
  startIndex: number
  commits: GitCommit[]
  hasMore: boolean
}

let segmentCounter = 0

function nextSegmentId(): string {
  segmentCounter += 1
  return `seg-${segmentCounter}`
}

export function createHistorySegment(commits: GitCommit[], hasMore: boolean, startIndex = 0, id?: string): GitHistorySegment {
  return {
    id: id || nextSegmentId(),
    startIndex: Math.max(0, Math.floor(startIndex)),
    commits,
    hasMore,
  }
}

function dedupeCommitsPreserveOrder(commits: GitCommit[]): GitCommit[] {
  const seen = new Set<string>()
  const out: GitCommit[] = []
  for (const commit of commits) {
    if (!seen.has(commit.hash)) {
      seen.add(commit.hash)
      out.push(commit)
    }
  }
  return out
}

function canMergeAdjacentSegments(upper: GitHistorySegment, lower: GitHistorySegment): boolean {
  if (upper.commits.length === 0 || lower.commits.length === 0) return true
  if (upper.startIndex + upper.commits.length >= lower.startIndex) return true
  const upperHashes = new Set(upper.commits.map((c) => c.hash))
  return lower.commits.some((c) => upperHashes.has(c.hash))
}

function mergeTwoSegments(upper: GitHistorySegment, lower: GitHistorySegment): GitHistorySegment {
  if (upper.commits.length === 0) {
    return { ...lower, id: upper.id }
  }
  if (lower.commits.length === 0) {
    return upper
  }

  const lowerFirstHash = lower.commits[0]?.hash
  const overlapInUpper = lowerFirstHash ? upper.commits.findIndex((c) => c.hash === lowerFirstHash) : -1

  let mergedCommits: GitCommit[]
  if (overlapInUpper >= 0) {
    mergedCommits = dedupeCommitsPreserveOrder([...upper.commits.slice(0, overlapInUpper), ...lower.commits])
  } else {
    mergedCommits = dedupeCommitsPreserveOrder([...upper.commits, ...lower.commits])
  }

  const upperEnd = upper.startIndex + upper.commits.length
  const lowerEnd = lower.startIndex + lower.commits.length

  return {
    id: upper.id,
    startIndex: Math.min(upper.startIndex, lower.startIndex),
    commits: mergedCommits,
    hasMore: lowerEnd >= upperEnd ? lower.hasMore : upper.hasMore,
  }
}

/**
 * Sort segments newest-to-oldest (`startIndex` ascending) and merge any adjacent or overlapping segments
 * so bridged ranges immediately combine into a single continuous graph layout.
 */
export function normalizeHistorySegments(segments: GitHistorySegment[]): GitHistorySegment[] {
  const nonEmpty = segments.filter((seg) => seg.commits.length > 0)
  if (nonEmpty.length === 0) return segments.slice(0, 1)

  const sorted = [...nonEmpty].sort((a, b) => a.startIndex - b.startIndex)
  const merged: GitHistorySegment[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = sorted[i]
    if (canMergeAdjacentSegments(prev, curr)) {
      merged[merged.length - 1] = mergeTwoSegments(prev, curr)
    } else {
      merged.push(curr)
    }
  }

  return merged
}

export function mergeHistorySegment(segments: GitHistorySegment[], incoming: GitHistorySegment): GitHistorySegment[] {
  if (incoming.commits.length === 0) return segments
  return normalizeHistorySegments([...segments, incoming])
}

export function appendCommitsToSegment(segments: GitHistorySegment[], segmentId: string, newCommits: GitCommit[], hasMore: boolean): GitHistorySegment[] {
  const next = segments.map((seg) => {
    if (seg.id !== segmentId) return seg
    const seen = new Set(seg.commits.map((c) => c.hash))
    const filtered = newCommits.filter((c) => !seen.has(c.hash))
    return {
      ...seg,
      commits: [...seg.commits, ...filtered],
      hasMore,
    }
  })
  return normalizeHistorySegments(next)
}

export function prependCommitsToSegment(segments: GitHistorySegment[], segmentId: string, newCommits: GitCommit[], newStartIndex: number): GitHistorySegment[] {
  const next = segments.map((seg) => {
    if (seg.id !== segmentId) return seg
    const seen = new Set(seg.commits.map((c) => c.hash))
    const uniqueNew = newCommits.filter((c) => !seen.has(c.hash))
    return {
      ...seg,
      startIndex: Math.max(0, Math.floor(newStartIndex)),
      commits: [...uniqueNew, ...seg.commits],
    }
  })
  return normalizeHistorySegments(next)
}

export function flattenSegmentsCommits(segments: GitHistorySegment[]): GitCommit[] {
  return dedupeCommitsPreserveOrder(segments.flatMap((seg) => seg.commits))
}

export function findCommitInSegments(segments: GitHistorySegment[], hashNeedle: string): { segment: GitHistorySegment; commit: GitCommit; indexInSegment: number } | null {
  const clean = hashNeedle.trim().toLowerCase()
  if (!clean) return null
  for (const segment of segments) {
    const idx = segment.commits.findIndex((c) => c.hash.toLowerCase() === clean || (clean.length >= 6 && c.hash.toLowerCase().startsWith(clean)))
    if (idx >= 0) {
      return { segment, commit: segment.commits[idx], indexInSegment: idx }
    }
  }
  return null
}

/**
 * Construct a minimal commit stub from sidebar ref metadata so the right-hand file tree can
 * begin loading diffs immediately while commit history locates the target segment.
 */
export function buildPendingCommitPlaceholder(view: GitLogView | null, hash: string, selection?: GitSelection): GitCommit | null {
  if (!view || !hash) return null
  const clean = hash.trim().toLowerCase()
  const branch = view.branches.find((b) => b.tip.toLowerCase() === clean || (clean.length >= 7 && b.tip.toLowerCase().startsWith(clean)))
  const remote = view.remotes.find((r) => r.tip.toLowerCase() === clean || (clean.length >= 7 && r.tip.toLowerCase().startsWith(clean)))
  const tag = view.tags.find((t) => t.tip.toLowerCase() === clean || (clean.length >= 7 && t.tip.toLowerCase().startsWith(clean)))

  const refs: string[] = []
  if (branch) refs.push(branch.current ? `HEAD -> ${branch.name}` : branch.name)
  if (remote && !refs.includes(remote.name)) refs.push(remote.name)
  if (tag) refs.push(`tag: ${tag.name}`)

  const label = (selection && 'name' in selection ? selection.name : '') || branch?.name || remote?.name || tag?.name || hash.slice(0, 7)

  return {
    hash,
    short: hash.slice(0, 7),
    parents: [],
    author: '',
    date: '',
    refs,
    subject: label,
  }
}
