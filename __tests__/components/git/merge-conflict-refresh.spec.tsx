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
