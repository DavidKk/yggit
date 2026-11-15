import { analyzeMergeTopology, parseBranchIntents } from '@/lib/git/topology'
import type { GitCommit } from '@/lib/git/types'

describe('topology', () => {
  describe('parseBranchIntents', () => {
    it('parses standard git merge messages', () => {
      const res1 = parseBranchIntents("Merge branch 'feature/JZY-3340' into main")
      expect(res1.source).toBe('feature/JZY-3340')
      expect(res1.target).toBe('main')

      const res2 = parseBranchIntents("Merge remote-tracking branch 'origin/feature/auth' into test")
      expect(res2.source).toBe('feature/auth')
      expect(res2.target).toBe('test')

      const res3 = parseBranchIntents("Merge branch 'bugfix/typo'")
      expect(res3.source).toBe('bugfix/typo')
      expect(res3.target).toBeUndefined()
    })

    it('parses pull request merge messages', () => {
      const res = parseBranchIntents('Merge pull request #128 from owner/feature/billing')
      expect(res.pr).toBe(128)
      expect(res.source).toBe('feature/billing')
    })
  })

  describe('analyzeMergeTopology', () => {
    it('identifies non-merge commits', () => {
      const commit: GitCommit = {
        hash: 'c1',
        short: 'c1',
        parents: ['c0'],
        author: 'Alice',
        date: '2026-11-15T12:00:00Z',
        refs: [],
        subject: 'feat: add button',
      }
      const info = analyzeMergeTopology(commit)
      expect(info.isMerge).toBe(false)
      expect(info.commitsIncluded).toEqual([])
    })

    it('analyzes merge topology with parent branches and included commits', () => {
      // Lineage:
      // c0 (base)
      // |\
      // | c1 (feature commit 1)
      // | c2 (feature commit 2)
      // |/
      // m1 (merge commit, parents: [c0, c2])
      const c0: GitCommit = {
        hash: 'c0',
        short: 'c0',
        parents: [],
        author: 'Alice',
        date: '2026-11-15T10:00:00Z',
        refs: ['main'],
        subject: 'initial commit',
      }
      const c1: GitCommit = {
        hash: 'c1',
        short: 'c1',
        parents: ['c0'],
        author: 'Bob',
        date: '2026-11-15T11:00:00Z',
        refs: [],
        subject: 'feat: step 1',
      }
      const c2: GitCommit = {
        hash: 'c2',
        short: 'c2',
        parents: ['c1'],
        author: 'Bob',
        date: '2026-11-15T12:00:00Z',
        refs: ['feature/test'],
        subject: 'feat: step 2',
      }
      const m1: GitCommit = {
        hash: 'm1',
        short: 'm1',
        parents: ['c0', 'c2'],
        author: 'Alice',
        date: '2026-11-15T13:00:00Z',
        refs: [],
        subject: "Merge branch 'feature/test' into main",
      }

      const map = new Map<string, GitCommit>([
        ['c0', c0],
        ['c1', c1],
        ['c2', c2],
        ['m1', m1],
      ])

      const info = analyzeMergeTopology(m1, map)
      expect(info.isMerge).toBe(true)
      expect(info.targetBranchHint).toBe('main')
      expect(info.sourceBranchHint).toBe('feature/test')
      expect(info.parent1Hash).toBe('c0')
      expect(info.parent2Hash).toBe('c2')
      expect(info.mergeBaseHash).toBe('c0')
      expect(info.commitsIncluded).toEqual(['c2', 'c1'])
    })
  })
})
