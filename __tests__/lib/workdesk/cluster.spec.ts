import { clusterFindingsToCards } from '@/lib/workdesk/cluster'
import type { Finding } from '@/lib/workdesk/types'

describe('Workdesk clusterFindingsToCards', () => {
  const sampleSyncFinding1: Finding = {
    id: 'f1',
    fingerprint: 'fp1',
    repoId: 'repo-alpha',
    repoAlias: 'Alpha Repo',
    kind: 'sync',
    source: 'git',
    severity: 'info',
    lifecycle: 'open',
    freshness: 'fresh',
    target: { name: 'main', oid: 'c1' },
    evidence: {
      ruleId: 'default-branch-sync',
      commits: ['c2', 'c1'],
      details: {
        stateKind: 'safe',
        conclusion: '远程领先，可安全快进',
      },
    },
    observedAt: 1000,
    baseCommitOid: 'c1',
    engineVersion: '1.0.0',
  }

  const sampleSyncFinding2: Finding = {
    id: 'f2',
    fingerprint: 'fp2',
    repoId: 'repo-beta',
    repoAlias: 'Beta Repo',
    kind: 'sync',
    source: 'git',
    severity: 'warning',
    lifecycle: 'open',
    freshness: 'fresh',
    target: { name: 'main', oid: 'c3' },
    evidence: {
      ruleId: 'default-branch-sync',
      commits: ['c4'],
      details: {
        stateKind: 'warn',
        conclusion: '本地工作区有未提交变更',
      },
    },
    observedAt: 2000,
    baseCommitOid: 'c3',
    engineVersion: '1.0.0',
  }

  const sampleParallelFinding: Finding = {
    id: 'f3',
    fingerprint: 'fp3',
    repoId: 'repo-alpha',
    repoAlias: 'Alpha Repo',
    kind: 'sync',
    source: 'git',
    severity: 'info',
    lifecycle: 'open',
    freshness: 'fresh',
    target: { name: 'feature/login', oid: 'c5' },
    evidence: {
      ruleId: 'feature-branch-health',
      commits: ['c5'],
      details: {
        branch: 'feature/login',
        stateKind: 'safe',
        conclusion: '特性分支领先 2 / 落后 0 个提交',
      },
    },
    observedAt: 3000,
    baseCommitOid: 'c5',
    engineVersion: '1.0.0',
  }

  it('aggregates default branch sync findings into a single sync-default-branches card', () => {
    const { cards, items } = clusterFindingsToCards([sampleSyncFinding1, sampleSyncFinding2])

    expect(cards).toHaveLength(1)
    const card = cards[0]
    expect(card.id).toBe('sync-default-branches')
    expect(card.title).toBe('同步默认分支')
    expect(card.categoryId).toBe('branch')
    expect(card.scope).toBe('2 个项目')
    expect(card.itemIds).toHaveLength(2)

    // Check generated items
    const item1 = items[card.itemIds[0]]
    expect(item1.repoAlias).toBe('Alpha Repo')
    expect(item1.state).toBe('safe')
    expect(item1.summary).toBe('远程领先，可安全快进')

    const item2 = items[card.itemIds[1]]
    expect(item2.repoAlias).toBe('Beta Repo')
    expect(item2.state).toBe('warn')
    expect(item2.summary).toBe('本地工作区有未提交变更')
  })

  it('aggregates parallel feature branch findings into worktree-parallel-dev card', () => {
    const { cards } = clusterFindingsToCards([sampleParallelFinding])

    expect(cards).toHaveLength(1)
    const card = cards[0]
    expect(card.id).toBe('worktree-parallel-dev')
    expect(card.title).toBe('检查并行开发工作')
    expect(card.categoryId).toBe('branch')
    expect(card.scope).toBe('1 个项目')
  })

  it('respects in-memory dismissed card IDs by setting hidden: true', () => {
    const dismissed = new Set(['sync-default-branches'])
    const { cards } = clusterFindingsToCards([sampleSyncFinding1], dismissed)

    expect(cards).toHaveLength(1)
    expect(cards[0].hidden).toBe(true)
  })

  it('ignores resolved findings', () => {
    const resolvedFinding: Finding = {
      ...sampleSyncFinding1,
      lifecycle: 'resolved',
    }
    const { cards } = clusterFindingsToCards([resolvedFinding])
    expect(cards).toHaveLength(0)
  })
})
