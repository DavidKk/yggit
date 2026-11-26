import { detectThreeWayConflicts } from '@/lib/git/driver/edge-conflicts'

describe('edge-conflicts', () => {
  it('detects overlapping 3-way edits as conflict regions', () => {
    const base = ['line1', 'line2', 'line3', 'line4'].join('\n')
    const ours = ['line1', 'ours2', 'line3', 'line4'].join('\n')
    const theirs = ['line1', 'theirs2', 'line3', 'line4'].join('\n')

    const res = detectThreeWayConflicts(base, ours, theirs, 'abc1234', 'def5678')
    expect(res.count).toBe(1)
    expect(res.conflictBlocks[0]).toContain('+<<<<<<< abc1234')
    expect(res.conflictBlocks[0]).toContain('+ours2')
    expect(res.conflictBlocks[0]).toContain('+=======')
    expect(res.conflictBlocks[0]).toContain('+theirs2')
    expect(res.conflictBlocks[0]).toContain('+>>>>>>> def5678')
  })

  it('treats non-overlapping edits on different lines as clean', () => {
    const base = ['line1', 'line2', 'line3', 'line4'].join('\n')
    const ours = ['ours1', 'line2', 'line3', 'line4'].join('\n')
    const theirs = ['line1', 'line2', 'line3', 'theirs4'].join('\n')

    const res = detectThreeWayConflicts(base, ours, theirs)
    expect(res.count).toBe(0)
    expect(res.conflictBlocks).toEqual([])
  })

  it('treats identical edits on both sides as clean', () => {
    const base = ['line1', 'line2'].join('\n')
    const same = ['line1', 'updated'].join('\n')

    const res = detectThreeWayConflicts(base, same, same)
    expect(res.count).toBe(0)
  })
})
