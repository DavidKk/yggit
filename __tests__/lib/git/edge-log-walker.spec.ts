import git from 'isomorphic-git'

import { MultiBranchLogSession } from '@/lib/git/driver/edge-log-walker'

jest.mock('isomorphic-git', () => ({
  __esModule: true,
  default: {
    readCommit: jest.fn(),
  },
}))

const mockReadCommit = git.readCommit as jest.MockedFunction<typeof git.readCommit>

describe('MultiBranchLogSession', () => {
  const commitGraph: Record<string, { parent: string[]; timestamp: number; message: string }> = {}

  beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(commitGraph)) delete commitGraph[key]

    // Build a linear chain c9 -> c8 -> ... -> c0 plus a side tip s5 -> c3
    for (let i = 0; i < 10; i++) {
      const oid = `c${i}`.padEnd(40, '0')
      const parent = i > 0 ? [`c${i - 1}`.padEnd(40, '0')] : []
      commitGraph[oid] = { parent, timestamp: 1700000000 + i * 100, message: `main ${i}` }
    }
    const sideTip = 's5'.padEnd(40, 'a')
    commitGraph[sideTip] = {
      parent: ['c3'.padEnd(40, '0')],
      timestamp: 1700000350,
      message: 'side tip',
    }

    mockReadCommit.mockImplementation(async ({ oid }) => {
      const clean = oid.toLowerCase()
      const data = commitGraph[clean]
      if (!data) throw new Error(`Missing ${oid}`)
      return {
        oid: clean,
        commit: {
          parent: data.parent,
          tree: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
          author: { name: 'Dev', email: 'dev@example.com', timestamp: data.timestamp, timezoneOffset: 0 },
          committer: { name: 'Dev', email: 'dev@example.com', timestamp: data.timestamp, timezoneOffset: 0 },
          message: data.message,
        },
        payload: '',
      }
    })
  })

  it('resumes pagination incrementally without re-reading earlier commits', async () => {
    const session = new MultiBranchLogSession({
      fs: {},
      tips: ['c9'.padEnd(40, '0'), 's5'.padEnd(40, 'a')],
    })

    const first = await session.ensureCount(3)
    expect(first).toHaveLength(3)
    const callsAfterFirst = mockReadCommit.mock.calls.length

    const second = await session.ensureCount(6)
    expect(second).toHaveLength(6)
    expect(second[0].oid).toBe('c9'.padEnd(40, '0'))
    expect(mockReadCommit.mock.calls.length - callsAfterFirst).toBeLessThanOrEqual(4)
  })

  it('locates a commit incrementally and stops immediately when aborted', async () => {
    const session = new MultiBranchLogSession({
      fs: {},
      tips: ['c9'.padEnd(40, '0'), 's5'.padEnd(40, 'a')],
    })

    const { commits, locatedIndex } = await session.locate('s5'.padEnd(40, 'a'), 2)
    expect(locatedIndex).toBe(6)
    expect(commits[locatedIndex].oid).toBe('s5'.padEnd(40, 'a'))

    const controller = new AbortController()
    controller.abort()
    await expect(session.locate('c0'.padEnd(40, '0'), 2, 100, controller.signal)).rejects.toThrow()
  })
})
