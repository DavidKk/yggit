import { analyzeMergeTopology, getBranchCommitHashes, parseBranchIntents } from '@/lib/git/topology'
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
      expect(parseBranchIntents("Merge branch 'bugfix/brotli-fix' into 'master'")).toEqual({ source: 'bugfix/brotli-fix', target: 'master' })
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

    it('highlights both merge arms through the common base without older ancestry or a depth limit', () => {
      const make = (hash: string, parents: string[]): GitCommit => ({
        hash,
        short: hash,
        parents,
        author: 'Test',
        date: '',
        refs: [],
        subject: hash,
      })
      const merge = make('merge', ['target', 'source-119'])
      const nodes = [merge, make('target', ['base']), make('base', ['older']), make('older', [])]
      for (let i = 0; i < 120; i++) nodes.push(make(`source-${i}`, [i ? `source-${i - 1}` : 'base']))
      const info = analyzeMergeTopology(merge, new Map(nodes.map((node) => [node.hash, node])))
      expect(info.commitsIncluded).toHaveLength(120)
      expect(info.highlightHashes).toEqual(expect.arrayContaining(['merge', 'target', 'source-119', 'source-0', 'base']))
      expect(info.highlightHashes).not.toContain('older')
      expect(info.highlightHashes).toHaveLength(124 - 1)
    })
  })

  describe('getBranchCommitHashes', () => {
    it('returns empty set if branchName is empty or commits is empty', () => {
      expect(getBranchCommitHashes('', [])).toEqual(new Set())
    })

    it('collects all ancestor commits of a branch tip', () => {
      const commits: GitCommit[] = [
        { hash: 'feat-2', short: 'feat-2', parents: ['feat-1'], author: 'A', date: '', refs: ['feat/agent-system'], subject: 'feat 2' },
        { hash: 'feat-1', short: 'feat-1', parents: ['main-1'], author: 'A', date: '', refs: [], subject: 'feat 1' },
        { hash: 'main-2', short: 'main-2', parents: ['main-1'], author: 'B', date: '', refs: ['main'], subject: 'main 2' },
        { hash: 'main-1', short: 'main-1', parents: [], author: 'B', date: '', refs: [], subject: 'main 1' },
      ]

      const hashes = getBranchCommitHashes('feat/agent-system', commits)
      expect(hashes.has('feat-2')).toBe(true)
      expect(hashes.has('feat-1')).toBe(true)
      expect(hashes.has('main-1')).toBe(true)
      expect(hashes.has('main-2')).toBe(false)
    })
  })
})
