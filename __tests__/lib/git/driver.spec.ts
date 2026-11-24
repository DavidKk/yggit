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

  it('updates and persists driver mode and dispatches event with payload', () => {
    const events: Array<{ mode: string; targetRepo?: string }> = []
    const listeners: Record<string, ((e: any) => void)[]> = {}
    const mockWindow = {
      localStorage: mockLocalStorage,
      dispatchEvent: (e: any) => {
        listeners[e.type]?.forEach((fn) => fn(e))
      },
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || []
        listeners[type].push(fn)
      },
      removeEventListener: (type: string, fn: any) => {
        listeners[type] = (listeners[type] || []).filter((f) => f !== fn)
      },
    }
    Object.defineProperty(global, 'window', { value: mockWindow, configurable: true, writable: true })

    const listener = (e: any) => {
      events.push(e.detail)
    }
    mockWindow.addEventListener('yggit:driver_mode_changed', listener)

    setDriverMode('edge', { targetRepo: 'repo-1' })
    expect(getDriverMode()).toBe('edge')
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ mode: 'edge', targetRepo: 'repo-1' })

    setDriverMode('local')
    expect(getDriverMode()).toBe('local')
    expect(events).toHaveLength(2)
    expect(events[1]).toEqual({ mode: 'local' })

    mockWindow.removeEventListener('yggit:driver_mode_changed', listener)
    // @ts-expect-error clean mock
    delete global.window
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
      await expect(driver.readLog({ repo: 'non-existent-local-folder' })).rejects.toThrow(/RESOURCE_UNRESOLVED/)
    })

    it('creates directory handle fs adapter supporting read, stat, readdir', async () => {
      const { createDirectoryHandleFs } = await import('@/lib/git/driver/handle-fs')
      const mockFiles: Record<string, string> = {
        HEAD: 'ref: refs/heads/main\n',
        config: '[core]\n\trepositoryformatversion = 0\n',
      }
      const mockHandle = {
        kind: 'directory',
        name: 'test-repo',
        async getDirectoryHandle(name: string) {
          if (name === '.git') return mockHandle
          throw new Error('NotFoundError')
        },
        async getFileHandle(name: string) {
          if (mockFiles[name] !== undefined) {
            return {
              kind: 'file',
              name,
              async getFile() {
                const text = mockFiles[name]
                return {
                  size: text.length,
                  lastModified: 1000,
                  async text() {
                    return text
                  },
                  async arrayBuffer() {
                    const encoder = new TextEncoder()
                    return encoder.encode(text).buffer
                  },
                }
              },
            }
          }
          throw new Error('NotFoundError')
        },
        async *keys() {
          for (const key of Object.keys(mockFiles)) yield key
        },
      } as unknown as FileSystemDirectoryHandle

      const fs = createDirectoryHandleFs(mockHandle)
      const head = await fs.promises.readFile('/HEAD', 'utf8')
      expect(head).toBe('ref: refs/heads/main\n')

      const stat = await fs.promises.stat('/HEAD')
      expect(stat.isFile()).toBe(true)
      expect(stat.size).toBeGreaterThan(0)

      const files = await fs.promises.readdir('/')
      expect(files).toContain('HEAD')
      expect(files).toContain('config')
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

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/git/log?repo=%2Fpath%2Fto%2Frepo&branch=main&skip=20'))
    })

    it('constructs correct query parameters for readCommitDiff', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hash: 'abc1234', files: [] }),
      })
      global.fetch = mockFetch

      const driver = new LocalGitDriver()
      await driver.readCommitDiff({ repo: '/path/to/repo', hash: 'abc1234', file: 'src/index.ts', all: true })

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/git/commit?repo=%2Fpath%2Fto%2Frepo&hash=abc1234&path=src%2Findex.ts&all=1'))
    })

    it('calls /api/git/projects for createFolder and deleteFolder', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, folders: ['新文件夹'], projects: [], removedCount: 1 }),
      })
      global.fetch = mockFetch

      const driver = new LocalGitDriver()
      const created = await driver.createFolder('新文件夹')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/git/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'createFolder', folder: '新文件夹' }),
        })
      )
      expect(created.folders).toContain('新文件夹')

      const deleted = await driver.deleteFolder('新文件夹')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/git/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'deleteFolder', folder: '新文件夹' }),
        })
      )
      expect(deleted.removedCount).toBe(1)
    })
  })
})
