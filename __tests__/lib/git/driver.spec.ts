import { EdgeGitDriver } from '@/lib/git/driver/edge-driver'
import { getDriverMode, getGitDriver, setDriverMode } from '@/lib/git/driver/index'
import { LocalGitDriver } from '@/lib/git/driver/local-driver'

describe('GitDriver layer', () => {
  const store: Record<string, string> = {}
  const mockLocalStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = val
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k])
    },
  }

  beforeAll(() => {
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    })
  })

  beforeEach(() => {
    mockLocalStorage.clear()
  })

  it('defaults to local mode when no preference stored', () => {
    expect(getDriverMode()).toBe('local')
  })

  it('updates and persists driver mode', () => {
    setDriverMode('edge')
    expect(getDriverMode()).toBe('edge')

    setDriverMode('local')
    expect(getDriverMode()).toBe('local')
  })

  it('returns appropriate driver instance for given mode', () => {
    const edge = getGitDriver('edge')
    expect(edge.mode).toBe('edge')
    expect(edge).toBeInstanceOf(EdgeGitDriver)

    const local = getGitDriver('local')
    expect(local.mode).toBe('local')
    expect(local).toBeInstanceOf(LocalGitDriver)
  })

  describe('EdgeGitDriver remote integration', () => {
    it('is available in browser-like environment', async () => {
      const driver = new EdgeGitDriver()
      expect(await driver.isAvailable()).toBe(true)
    })

    it('rejects unresolved local handle with RESOURCE_UNRESOLVED', async () => {
      const driver = new EdgeGitDriver()
      await expect(driver.readLog({ repo: 'non-existent-local-folder' })).rejects.toThrow(
        /RESOURCE_UNRESOLVED/
      )
    })
  })

  describe('LocalGitDriver API calls', () => {
    it('constructs correct query parameters for readLog', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ commits: [], branches: [] }),
      })
      global.fetch = mockFetch

      const driver = new LocalGitDriver()
      await driver.readLog({ repo: '/path/to/repo', branch: 'main', skip: 20 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/git/log?repo=%2Fpath%2Fto%2Frepo&branch=main&skip=20')
      )
    })

    it('constructs correct query parameters for readCommitDiff', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hash: 'abc1234', files: [] }),
      })
      global.fetch = mockFetch

      const driver = new LocalGitDriver()
      await driver.readCommitDiff({ repo: '/path/to/repo', hash: 'abc1234', file: 'src/index.ts', all: true })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/git/commit?repo=%2Fpath%2Fto%2Frepo&hash=abc1234&path=src%2Findex.ts&all=1')
      )
    })
  })
})
