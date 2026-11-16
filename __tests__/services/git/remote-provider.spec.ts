import { parseGitHubRepo } from '@/services/git/remote-provider'

describe('remote-provider', () => {
  it('correctly extracts owner and repo from various URL formats', () => {
    expect(parseGitHubRepo('https://github.com/DavidKk/yggit')).toEqual({
      owner: 'DavidKk',
      repo: 'yggit',
    })
    expect(parseGitHubRepo('https://github.com/facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    })
    expect(parseGitHubRepo('git@github.com:vercel/next.js.git')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    })
    expect(parseGitHubRepo('torvalds/linux')).toEqual({
      owner: 'torvalds',
      repo: 'linux',
    })
    expect(parseGitHubRepo('github.com/golang/go')).toEqual({
      owner: 'golang',
      repo: 'go',
    })
    expect(parseGitHubRepo('invalid-repo')).toBeNull()
  })
})

describe('remote history and changes', () => {
  const originalFetch = global.fetch
  let requests: string[]
  let repo: string
  let commitCount: number
  let failure: number

  const commit = (index: number) => ({
    sha: String(index).padStart(40, '0'),
    parents: index + 1 < commitCount ? [{ sha: String(index + 1).padStart(40, '0') }] : [],
    commit: { author: { name: 'Author', date: '2026-11-15T00:00:00Z' }, message: `Commit ${index}` },
  })

  beforeEach(() => {
    repo = `https://github.com/history/case-${expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, '-')}`
    requests = []
    commitCount = 125
    failure = 0
    global.fetch = jest.fn(async (input) => {
      const url = new URL(String(input))
      requests.push(url.pathname + url.search)
      if (failure) return new Response('Access denied', { status: failure })
      if (url.pathname.endsWith('/branches')) return Response.json([{ name: 'trunk', commit: { sha: commit(0).sha } }])
      if (url.pathname.endsWith('/commits')) {
        const page = Number(url.searchParams.get('page'))
        return Response.json(Array.from({ length: Math.max(0, Math.min(100, commitCount - (page - 1) * 100)) }, (_, i) => commit((page - 1) * 100 + i)))
      }
      return Response.json({ default_branch: 'trunk' })
    }) as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('uses the default branch for wildcard and returns a bounded history window', async () => {
    const { readRemoteGitLog } = await import('@/services/git/remote-provider')
    const view = await readRemoteGitLog(repo, '*')
    expect(view.branch).toBe('trunk')
    expect(view.commits).toHaveLength(40)
    expect(view.hasMore).toBe(true)
    expect(requests.some((url) => url.includes('sha=trunk'))).toBe(true)
    expect(requests.join(' ')).not.toContain('sha=*')
  })

  it('paginates across API pages without repeating the first page in Edge mode', async () => {
    const { EdgeGitDriver } = await import('@/lib/git/driver/edge-driver')
    const driver = new EdgeGitDriver()
    const view = await driver.readLog({ repo, ref: commit(0).sha, skip: 80 })
    expect(view.commits).toHaveLength(40)
    expect(view.commits[0].hash).toBe(commit(80).sha)
    expect(view.commits[39].hash).toBe(commit(119).sha)
    expect(view.hasMore).toBe(true)
    const last = await driver.readLog({ repo, ref: commit(0).sha, skip: 120 })
    expect(last.commits).toHaveLength(5)
    expect(last.hasMore).toBe(false)
  })

  it('ends pagination exactly at the final full window', async () => {
    commitCount = 40
    const { readRemoteGitLog } = await import('@/services/git/remote-provider')
    const view = await readRemoteGitLog(repo)
    expect(view.commits).toHaveLength(40)
    expect(view.hasMore).toBe(false)
  })

  it.each([404, 403, 429])('propagates HTTP %s instead of presenting an empty repository', async (status) => {
    failure = status
    const { readRemoteGitLog } = await import('@/services/git/remote-provider')
    await expect(readRemoteGitLog(repo)).rejects.toThrow(status === 429 ? /rate limit/ : new RegExp(String(status)))
  })

  it('propagates commit API errors after repository metadata succeeds', async () => {
    const metadataFetch = global.fetch
    global.fetch = jest.fn(async (input) => (String(input).includes('/commits?') ? new Response('Missing branch', { status: 404 }) : metadataFetch(input))) as typeof fetch
    const { readRemoteGitLog } = await import('@/services/git/remote-provider')
    await expect(readRemoteGitLog(repo, 'missing')).rejects.toThrow(/404/)
  })

  it('returns patches and file contents with encoded Unicode paths', async () => {
    global.fetch = jest.fn(async (input) => {
      requests.push(String(input))
      if (String(input).includes('raw.githubusercontent.com')) return new Response('new\n')
      return Response.json({ files: [{ filename: '中文/a #.txt', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' }] })
    }) as typeof fetch
    const { readRemoteCommitChanges } = await import('@/services/git/remote-provider')
    const result = await readRemoteCommitChanges(repo, 'abc1234', { file: '中文/a #.txt' })
    expect(result.patch).toContain('-old\n+new')
    expect(result.content).toBe('new\n')
    expect(result.files[0].path).toBe('中文/a #.txt')
    expect(requests[1]).toContain('%E4%B8%AD%E6%96%87/a%20%23.txt')
  })

  it('lists the full remote tree when all files are requested', async () => {
    global.fetch = jest.fn(async () =>
      Response.json({
        tree: [
          { path: 'src', type: 'tree' },
          { path: 'src/a.ts', type: 'blob' },
        ],
        truncated: true,
      })
    ) as typeof fetch
    const { readRemoteCommitChanges } = await import('@/services/git/remote-provider')
    const result = await readRemoteCommitChanges(repo, 'abc1234', { tree: true, all: true })
    expect(result.files.map((file) => file.path)).toEqual(['src/a.ts'])
    expect(result.truncated).toBe(true)
  })
})
