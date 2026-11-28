import {
  appendCommitsToSegment,
  buildPendingCommitPlaceholder,
  createHistorySegment,
  findCommitInSegments,
  flattenSegmentsCommits,
  mergeHistorySegment,
  prependCommitsToSegment,
} from '@/lib/git/history-segments'
import type { GitCommit, GitLogView } from '@/lib/git/types'

function makeCommit(idx: number): GitCommit {
  const hash = idx.toString(16).padStart(8, '0').padEnd(40, 'a')
  return {
    hash,
    short: hash.slice(0, 7),
    parents: [],
    author: 'Tester',
    date: `2026-11-28T00:${String(idx % 60).padStart(2, '0')}:00.000Z`,
    refs: idx === 0 ? ['HEAD -> main'] : [],
    subject: `commit ${idx}`,
  }
}

describe('history-segments', () => {
  it('keeps non-overlapping jumped segment separate and bridges them via upward prepend', () => {
    const pageA = Array.from({ length: 5 }, (_, i) => makeCommit(i))
    const pageB = Array.from({ length: 5 }, (_, i) => makeCommit(5 + i))
    const pageC = Array.from({ length: 5 }, (_, i) => makeCommit(10 + i))

    let segments = [createHistorySegment(pageA, true, 0, 'seg-a')]
    segments = mergeHistorySegment(segments, createHistorySegment(pageC, true, 10, 'seg-c'))

    expect(segments).toHaveLength(2)
    expect(segments[0].startIndex).toBe(0)
    expect(segments[1].startIndex).toBe(10)

    segments = prependCommitsToSegment(segments, 'seg-c', pageB, 5)
    expect(segments).toHaveLength(1)
    expect(segments[0].startIndex).toBe(0)
    expect(segments[0].commits.map((c) => c.subject)).toEqual(Array.from({ length: 15 }, (_, i) => `commit ${i}`))
  })

  it('merges overlapping segments cleanly without duplicate commits', () => {
    const segA = createHistorySegment(
      Array.from({ length: 6 }, (_, i) => makeCommit(i)),
      true,
      0,
      'a'
    )
    const segOverlap = createHistorySegment(
      Array.from({ length: 6 }, (_, i) => makeCommit(4 + i)),
      false,
      4,
      'b'
    )

    const merged = mergeHistorySegment([segA], segOverlap)
    expect(merged).toHaveLength(1)
    expect(merged[0].commits).toHaveLength(10)
    expect(merged[0].hasMore).toBe(false)
    expect(flattenSegmentsCommits(merged)).toHaveLength(10)
  })

  it('auto-merges downward append when bottom of A reaches top of C', () => {
    const segA = createHistorySegment(
      Array.from({ length: 4 }, (_, i) => makeCommit(i)),
      true,
      0,
      'a'
    )
    const segC = createHistorySegment(
      Array.from({ length: 4 }, (_, i) => makeCommit(6 + i)),
      false,
      6,
      'c'
    )
    const combined = mergeHistorySegment([segA], segC)
    expect(combined).toHaveLength(2)

    const bridged = appendCommitsToSegment(combined, 'a', [makeCommit(4), makeCommit(5)], true)
    expect(bridged).toHaveLength(1)
    expect(bridged[0].commits).toHaveLength(10)
    expect(bridged[0].hasMore).toBe(false)
  })

  it('finds commits by full or prefix hash across segments and builds pending placeholders', () => {
    const segA = createHistorySegment([makeCommit(1)], true, 0, 'a')
    const target = makeCommit(42)
    const segC = createHistorySegment([target], false, 40, 'c')
    const hit = findCommitInSegments([segA, segC], target.short)

    expect(hit?.segment.id).toBe('c')
    expect(hit?.commit.hash).toBe(target.hash)

    const stubView = {
      repo: '/repo',
      displayPath: 'repo',
      head: 'main',
      branch: 'main',
      branches: [{ name: 'feature/test', current: false, tip: target.hash, upstream: '' }],
      remotes: [],
      tags: [],
      stashes: [],
      worktrees: [],
      submodules: [],
      commits: [],
      hasMore: false,
      marks: {},
      worktree: null,
    } satisfies GitLogView

    const placeholder = buildPendingCommitPlaceholder(stubView, target.hash, { kind: 'local', name: 'feature/test' })
    expect(placeholder).toMatchObject({
      hash: target.hash,
      short: target.hash.slice(0, 7),
      subject: 'feature/test',
      refs: ['feature/test'],
    })
  })
})
