import type { Finding, WorkdeskStoreData } from '@/lib/workdesk/types'

let persistedStore: WorkdeskStoreData | null = null
let activeProjects = [
  {
    id: 'proj_1',
    name: 'demo',
    group: '工作项目',
    host: 'local' as const,
    localPath: '/Users/example/demo',
    httpsUrl: '',
    local: true,
    remote: false,
    authorized: false,
  },
]

let inFlightReads = 0
let maxConcurrentReads = 0

const mockGetProjects = jest.fn(async () => ({
  projects: activeProjects,
  folders: ['工作项目'],
}))

const mockReadLog = jest.fn(async ({ repo }: { repo: string }) => {
  inFlightReads += 1
  if (inFlightReads > maxConcurrentReads) maxConcurrentReads = inFlightReads
  await new Promise((resolve) => setTimeout(resolve, 10))
  inFlightReads -= 1
  return {
    repo,
    displayPath: repo,
    head: 'main',
    branch: 'main',
    branches: [
      { name: 'main', upstream: 'origin/main', current: true, tip: 'aaaa1111', ahead: 0, behind: 0 },
      { name: 'feature/pending', upstream: 'origin/feature/pending', current: false, tip: 'bbbb2222', ahead: 2, behind: 0 },
    ],
    remotes: [{ name: 'origin/main', tip: 'aaaa1111' }],
    tags: [],
    stashes: [],
    worktrees: [],
    submodules: [],
    commits: [{ hash: 'bbbb2222', shortHash: 'bbbb222', parents: [], author: 'dev', date: new Date().toISOString(), refs: [], subject: 'wip commit' }],
    hasMore: false,
    marks: {},
    worktree: { files: 0, insertions: 0, deletions: 0, staged: 0, unstaged: 0, untracked: 0, changes: [] },
  }
})

jest.mock('@/lib/git/driver', () => ({
  getDriverMode: () => 'local',
  getGitDriver: () => ({
    getProjects: mockGetProjects,
    readLog: mockReadLog,
  }),
}))

jest.mock('@/lib/workdesk/storage', () => ({
  getDismissedCardIds: () => new Set<string>(),
  loadWorkdeskStore: jest.fn(async () => persistedStore),
  saveWorkdeskStore: jest.fn(async (data: WorkdeskStoreData) => {
    persistedStore = data
  }),
}))

import { workdeskEngine } from '@/lib/workdesk/engine'

describe('WorkdeskEngine compact store & serial queue', () => {
  beforeEach(() => {
    persistedStore = null
    inFlightReads = 0
    maxConcurrentReads = 0
    mockReadLog.mockClear()
    mockGetProjects.mockClear()
    activeProjects = [
      {
        id: 'proj_1',
        name: 'demo',
        group: '工作项目',
        host: 'local' as const,
        localPath: '/Users/example/demo',
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: false,
      },
    ]
    ;(workdeskEngine as unknown as { cachedResult: null }).cachedResult = null
  })

  it('persists only open findings without duplicate cards/items and derives them on loadInitial', async () => {
    const scanResult = await workdeskEngine.scan({ force: true })
    expect(scanResult.findings.some((f: Finding) => f.lifecycle === 'resolved')).toBe(true)
    expect(scanResult.findings.some((f: Finding) => f.lifecycle === 'open')).toBe(true)

    expect(persistedStore).not.toBeNull()
    expect(persistedStore!.cards).toBeUndefined()
    expect(persistedStore!.items).toBeUndefined()
    expect(persistedStore!.findings.every((f) => f.lifecycle === 'open')).toBe(true)

    ;(workdeskEngine as unknown as { cachedResult: null }).cachedResult = null
    const loaded = await workdeskEngine.loadInitial()
    expect(loaded).not.toBeNull()
    expect(loaded!.cards.map((c) => c.id)).toEqual(scanResult.cards.map((c) => c.id))
    expect(Object.keys(loaded!.items).sort()).toEqual(Object.keys(scanResult.items).sort())
  })

  it('processes multiple repositories strictly serially (concurrency = 1) and supports zero-scan recluster', async () => {
    activeProjects = [
      { id: 'p1', name: 'one', group: '工作项目', host: 'local', localPath: '/tmp/one', httpsUrl: '', local: true, remote: false, authorized: false },
      { id: 'p2', name: 'two', group: '工作项目', host: 'local', localPath: '/tmp/two', httpsUrl: '', local: true, remote: false, authorized: false },
      { id: 'p3', name: 'three', group: '工作项目', host: 'local', localPath: '/tmp/three', httpsUrl: '', local: true, remote: false, authorized: false },
    ]

    const result = await workdeskEngine.scan({ force: true })
    expect(mockReadLog).toHaveBeenCalledTimes(3)
    expect(maxConcurrentReads).toBe(1)
    expect(result.cards.length).toBeGreaterThan(0)

    mockReadLog.mockClear()
    const reclustered = workdeskEngine.recluster()
    expect(reclustered).not.toBeNull()
    expect(mockReadLog).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent loadInitial and loadInitialForRepo calls', async () => {
    const { loadWorkdeskStore } = jest.requireMock<{ loadWorkdeskStore: jest.Mock }>('@/lib/workdesk/storage')
    await workdeskEngine.scan({ force: true })
    loadWorkdeskStore.mockClear()
    ;(workdeskEngine as unknown as { cachedResult: null; emptyStoreLoaded: boolean }).cachedResult = null
    ;(workdeskEngine as unknown as { emptyStoreLoaded: boolean }).emptyStoreLoaded = false

    const [a, b, c] = await Promise.all([workdeskEngine.loadInitial(), workdeskEngine.loadInitial(), workdeskEngine.loadInitial()])
    expect(loadWorkdeskStore).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(b).toBe(c)

    loadWorkdeskStore.mockClear()
    ;(workdeskEngine as unknown as { cachedResult: null }).cachedResult = null
    const [r1, r2] = await Promise.all([workdeskEngine.loadInitialForRepo('demo'), workdeskEngine.loadInitialForRepo('demo')])
    expect(loadWorkdeskStore).toHaveBeenCalledTimes(1)
    expect(loadWorkdeskStore).toHaveBeenCalledWith('demo')
    expect(r1).toBe(r2)
  })
})
