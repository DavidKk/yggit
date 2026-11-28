/** @jest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'

import { useMergeConflicts } from '@/components/git/useMergeConflicts'
import { getCachedConflictsBatch, queryConflictsBatch } from '@/lib/git/conflict-cache'
import type { GitCommit } from '@/lib/git/types'

jest.mock('@/lib/git/conflict-cache', () => ({
  getCachedConflictsBatch: jest.fn(),
  queryConflictsBatch: jest.fn(),
}))

it('refreshes a selected legacy merge outside the visible graph after a scroll timer is cancelled', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.useFakeTimers()
  const container = document.createElement('div')
  const scroller = document.createElement('div')
  const scrollRef = { current: scroller }
  const root = createRoot(container)
  const commits: GitCommit[] = Array.from({ length: 100 }, (_, i) => ({
    hash: `commit-${i}`,
    short: `${i}`,
    parents: i === 99 ? ['first', 'second'] : [],
    refs: [],
    subject: '',
    author: '',
    date: '',
  }))
  const legacy = { hash: 'commit-99', hasConflict: true, conflictFiles: ['file.txt'], status: 'conflicted' as const, analyzedAt: 1 }
  jest.mocked(getCachedConflictsBatch).mockResolvedValue({ 'commit-99': legacy })
  jest.mocked(queryConflictsBatch).mockResolvedValue({ 'commit-99': { ...legacy, conflictFileCounts: { 'file.txt': 2 } } })
  function Harness({ selectedHash }: { selectedHash?: string }) {
    useMergeConflicts({ repo: 'repo', commits, scrollRef, selectedHash })
    return null
  }
  try {
    await act(async () => root.render(<Harness />))
    await act(async () => scroller.dispatchEvent(new Event('scroll')))
    await act(async () => root.render(<Harness selectedHash="commit-99" />))
    await act(async () => jest.advanceTimersByTime(800))
    expect(queryConflictsBatch).toHaveBeenCalledWith('repo', [{ hash: 'commit-99', parents: ['first', 'second'] }], expect.any(AbortSignal))
  } finally {
    await act(async () => root.unmount())
    jest.useRealTimers()
  }
})

it('does not starve fresh merges when an earlier merge returned status error', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.useFakeTimers()
  jest.mocked(queryConflictsBatch).mockReset()
  jest.mocked(getCachedConflictsBatch).mockReset()

  const container = document.createElement('div')
  const root = createRoot(container)
  const commits: GitCommit[] = Array.from({ length: 6 }, (_, i) => ({
    hash: `merge-${i}`,
    short: `${i}`,
    parents: ['p1', 'p2'],
    refs: [],
    subject: '',
    author: '',
    date: '',
  }))

  jest.mocked(getCachedConflictsBatch).mockResolvedValue({
    'merge-0': { hash: 'merge-0', hasConflict: false, status: 'error', analyzedAt: 1 },
  })
  jest.mocked(queryConflictsBatch).mockImplementation(async (_repo, batch) =>
    Object.fromEntries(
      batch.map((c) => [
        c.hash,
        {
          hash: c.hash,
          hasConflict: c.hash === 'merge-5',
          conflictFiles: c.hash === 'merge-5' ? ['conflict.go'] : [],
          conflictFileCounts: (c.hash === 'merge-5' ? { 'conflict.go': 1 } : {}) as Record<string, number | null>,
          unresolvedConflictFiles: [],
          status: c.hash === 'merge-5' ? ('conflicted' as const) : ('clean' as const),
          analyzedAt: 2,
        },
      ])
    )
  )

  let latestConflict: ReturnType<typeof useMergeConflicts>['conflicts'] = {}
  function Harness() {
    latestConflict = useMergeConflicts({ repo: 'edge_starve_test', commits }).conflicts
    return null
  }
  try {
    await act(async () => root.render(<Harness />))
    await act(async () => jest.advanceTimersByTime(300))
    const firstBatchHashes = jest.mocked(queryConflictsBatch).mock.calls[0]?.[1].map((c) => c.hash)
    expect(firstBatchHashes).toEqual(['merge-1', 'merge-2', 'merge-3', 'merge-4', 'merge-5'])
    expect(latestConflict['merge-5']?.hasConflict).toBe(true)
  } finally {
    await act(async () => root.unmount())
    jest.useRealTimers()
  }
})
