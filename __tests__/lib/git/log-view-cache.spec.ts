import { clearRepoLogCache, getCachedRepoLog, hasGitLogViewChanged, repoLogCacheKey, setCachedRepoLog } from '@/lib/git/log-view-cache'
import type { GitLogView } from '@/lib/git/types'

function makeView(overrides: Partial<GitLogView> = {}): GitLogView {
  return {
    repo: 'https://github.com/DavidKk/yggit',
    displayPath: 'DavidKk/yggit',
    head: 'abc1234',
    branch: 'main',
    branches: [{ name: 'main', upstream: 'origin/main', current: true, tip: 'abc1234' }],
    remotes: [],
    tags: [],
    stashes: [],
    worktrees: [],
    submodules: [],
    commits: [
      {
        hash: 'abc1234',
        short: 'abc1234',
        parents: [],
        author: 'David',
        date: '2026-11-26T00:00:00.000Z',
        refs: ['main'],
        subject: 'init',
      },
    ],
    hasMore: false,
    marks: {},
    worktree: null,
    ...overrides,
  }
}

describe('log-view-cache', () => {
  beforeEach(() => {
    clearRepoLogCache()
  })

  it('normalizes remote URLs and shorthand into the same cache key', () => {
    expect(repoLogCacheKey('https://github.com/DavidKk/yggit')).toBe(repoLogCacheKey('https://github.com/DavidKk/yggit.git'))
    expect(repoLogCacheKey('git@github.com:DavidKk/yggit.git')).toBe(repoLogCacheKey('https://github.com/DavidKk/yggit'))
    expect(repoLogCacheKey('/Users/dev/project')).toBe('local:/Users/dev/project')
  })

  it('stores and retrieves cached GitLogView across normalized keys', () => {
    const view = makeView()
    setCachedRepoLog('https://github.com/DavidKk/yggit.git', view)
    const hit = getCachedRepoLog('https://github.com/DavidKk/yggit')
    expect(hit?.view.head).toBe('abc1234')
  })

  it('detects meaningful view changes while ignoring identical snapshots', () => {
    const a = makeView()
    const b = makeView()
    expect(hasGitLogViewChanged(a, b)).toBe(false)
    expect(hasGitLogViewChanged(a, makeView({ head: 'def5678' }))).toBe(true)
    expect(hasGitLogViewChanged(a, makeView({ branch: 'dev' }))).toBe(true)
  })
})
