import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { EdgeGitDriver } from '@/lib/git/driver/edge-driver'
import { parseGitConfigText, readGitRemotesFromHandle } from '@/lib/git/driver/edge-git-config'
import { createEdgeBranch, createEdgeTag, deleteEdgeBranch, deleteEdgeTag, readEdgeRefsSnapshot } from '@/lib/git/driver/edge-git-refs'
import { stageEdgeFiles, unstageEdgeFiles } from '@/lib/git/driver/edge-git-write'
import { EdgeRepositoryReader } from '@/lib/git/driver/edge-repository-reader'
import { getDirectoryHandle } from '@/lib/git/indexeddb-handles'

jest.mock('@/lib/git/indexeddb-handles', () => ({
  getDirectoryHandle: jest.fn(),
}))

function createWritableRwHandle(directoryPath: string): FileSystemDirectoryHandle {
  const getFileHandle = async (name: string, opts?: { create?: boolean }) => {
    const entry = path.join(directoryPath, name)
    if (!opts?.create) {
      if (!(await fs.stat(entry)).isFile()) throw new Error('Not a file')
    }
    return {
      kind: 'file' as const,
      name,
      async getFile() {
        const stat = await fs.stat(entry)
        return {
          size: stat.size,
          lastModified: stat.mtimeMs,
          async arrayBuffer() {
            return Uint8Array.from(await fs.readFile(entry)).buffer
          },
          async text() {
            return fs.readFile(entry, 'utf8')
          },
        }
      },
      async createWritable() {
        const chunks: Uint8Array[] = []
        return {
          async write(data: unknown) {
            if (typeof data === 'string') {
              chunks.push(new TextEncoder().encode(data))
            } else if (data instanceof Uint8Array) {
              chunks.push(data)
            } else if (data instanceof ArrayBuffer) {
              chunks.push(new Uint8Array(data))
            } else if (ArrayBuffer.isView(data)) {
              chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
            }
          },
          async close() {
            const total = chunks.reduce((acc, c) => acc + c.byteLength, 0)
            const merged = new Uint8Array(total)
            let offset = 0
            for (const chunk of chunks) {
              merged.set(chunk, offset)
              offset += chunk.byteLength
            }
            await fs.mkdir(path.dirname(entry), { recursive: true })
            await fs.writeFile(entry, merged)
          },
        }
      },
    }
  }

  return {
    name: path.basename(directoryPath),
    kind: 'directory',
    async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
      const entry = path.join(directoryPath, name)
      if (opts?.create) {
        await fs.mkdir(entry, { recursive: true })
        return createWritableRwHandle(entry)
      }
      if (!(await fs.stat(entry)).isDirectory()) throw new Error('Not a directory')
      return createWritableRwHandle(entry)
    },
    getFileHandle,
    async removeEntry(name: string, opts?: { recursive?: boolean }) {
      const entry = path.join(directoryPath, name)
      await fs.rm(entry, { recursive: Boolean(opts?.recursive), force: false })
    },
    async *entries() {
      const dirents = await fs.readdir(directoryPath, { withFileTypes: true })
      for (const dirent of dirents) {
        if (dirent.isDirectory()) {
          yield [dirent.name, createWritableRwHandle(path.join(directoryPath, dirent.name))] as [string, FileSystemHandle]
        } else if (dirent.isFile()) {
          const handle = await getFileHandle(dirent.name)
          yield [dirent.name, handle] as unknown as [string, FileSystemHandle]
        }
      }
    },
  } as unknown as FileSystemDirectoryHandle
}

describe('Edge Git toolkit', () => {
  let repoDir = ''

  function gitCmd(...args: string[]) {
    return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', repoDir, ...args], { encoding: 'utf8' }).trim()
  }

  beforeEach(async () => {
    repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yggit-edge-toolkit-'))
    gitCmd('init', '-q', '-b', 'main')
    gitCmd('config', 'user.name', 'Edge Tester')
    gitCmd('config', 'user.email', 'edge@yggit.local')
    await fs.writeFile(path.join(repoDir, 'a.txt'), 'v1\n')
    await fs.writeFile(path.join(repoDir, 'b.txt'), 'keep\n')
    gitCmd('add', '.')
    gitCmd('commit', '-qm', 'init commit')
    gitCmd('remote', 'add', 'origin', 'https://github.com/example/edge-toolkit.git')
  })

  afterEach(async () => {
    if (repoDir) {
      await fs.rm(repoDir, { recursive: true, force: true })
    }
  })

  it('parses .git/config remotes and branch tracking without invoking isomorphic-git', async () => {
    const configText = `
[core]
  repositoryformatversion = 0
[remote "origin"]
  url = https://github.com/acme/demo.git # inline comment
  fetch = +refs/heads/*:refs/remotes/origin/*
[remote "upstream"]
  url = "git@github.com:acme/upstream.git"
[branch "feat/fast-ui"]
  remote = origin
  merge = refs/heads/feat/fast-ui
`
    const parsed = parseGitConfigText(configText)
    expect(parsed.remotes).toEqual([
      { remote: 'origin', url: 'https://github.com/acme/demo.git' },
      { remote: 'upstream', url: 'git@github.com:acme/upstream.git' },
    ])
    expect(parsed.branchUpstreams.get('feat/fast-ui')).toEqual({
      remote: 'origin',
      merge: 'refs/heads/feat/fast-ui',
    })

    const remotes = await readGitRemotesFromHandle(createWritableRwHandle(repoDir))
    expect(remotes).toEqual([{ remote: 'origin', url: 'https://github.com/example/edge-toolkit.git' }])
  })

  it('stages dirty additions, modifications, and deletions then unstages via reader cache cleanly', async () => {
    const reader = new EdgeRepositoryReader(createWritableRwHandle(repoDir))
    try {
      await fs.writeFile(path.join(repoDir, 'a.txt'), 'v2\n')
      await fs.writeFile(path.join(repoDir, 'new.txt'), 'new file\n')
      await fs.unlink(path.join(repoDir, 'b.txt'))

      const before = await reader.worktreeFiles()
      expect(before.map((f) => [f.path, f.status])).toEqual([
        ['a.txt', 'M'],
        ['b.txt', 'D'],
        ['new.txt', 'A'],
      ])

      await stageEdgeFiles(reader, undefined, true)
      const afterStageAll = await reader.worktreeFiles()
      expect(afterStageAll).toEqual([
        { path: 'a.txt', status: 'M', oldPath: '', staged: true, unstaged: false },
        { path: 'b.txt', status: 'D', oldPath: '', staged: true, unstaged: false },
        { path: 'new.txt', status: 'A', oldPath: '', staged: true, unstaged: false },
      ])

      await unstageEdgeFiles(reader, ['a.txt'])
      const afterPartialUnstage = await reader.worktreeFiles()
      expect(afterPartialUnstage.find((f) => f.path === 'a.txt')).toEqual({
        path: 'a.txt',
        status: 'M',
        oldPath: '',
        staged: false,
        unstaged: true,
      })
      expect(afterPartialUnstage.find((f) => f.path === 'new.txt')?.staged).toBe(true)

      await unstageEdgeFiles(reader, undefined, true)
      const afterUnstageAll = await reader.worktreeFiles()
      expect(afterUnstageAll.every((f) => !f.staged)).toBe(true)
    } finally {
      reader.dispose()
    }
  })

  it('keeps reader caches alive across ref/tag mutations and shields observer during internal index writes', async () => {
    const handle = createWritableRwHandle(repoDir)
    jest.mocked(getDirectoryHandle).mockResolvedValue(handle)
    const driver = new EdgeGitDriver()

    let observerCallback: ((records: Array<{ type?: string; relativePathComponents?: string[] }>) => void) | undefined
    const mockObserver = {
      observe: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    }
    const g = globalThis as unknown as { FileSystemObserver?: unknown }
    const origObserver = g.FileSystemObserver
    g.FileSystemObserver = jest.fn((cb: (records: Array<{ type?: string; relativePathComponents?: string[] }>) => void) => {
      observerCallback = cb
      return mockObserver
    })

    try {
      const logBefore = await driver.readLog({ repo: 'edge_repo_test' })
      expect(logBefore.branches[0]?.name).toBe('main')

      await driver.createTag('edge_repo_test', 'v1.0.0')
      await driver.createBranch('edge_repo_test', 'feat/no-checkout', undefined, false)
      const reader = new EdgeRepositoryReader(handle)

      await fs.writeFile(path.join(repoDir, 'a.txt'), 'v2\n')
      await reader.worktreeFiles()

      // Simulate async FileSystemObserver callback for our own internal .git/index write
      await reader.runInternalIndexWrite(async () => {
        await stageEdgeFiles(reader, ['a.txt'])
        observerCallback?.([
          { type: 'modified', relativePathComponents: ['.git', 'index.lock'] },
          { type: 'modified', relativePathComponents: ['.git', 'index'] },
        ])
      })

      // observerClean should remain intact so a clean follow-up read stays cached without clearing fs
      const clearSpy = jest.spyOn(reader.fs, 'clearCache')
      const cached = await reader.worktreeFiles()
      expect(cached).toEqual([{ path: 'a.txt', status: 'M', oldPath: '', staged: true, unstaged: false }])
      expect(clearSpy).not.toHaveBeenCalled()

      // External .git/HEAD mutation must still invalidate observerClean
      observerCallback?.([{ type: 'modified', relativePathComponents: ['.git', 'HEAD'] }])
      await reader.worktreeFiles()
      expect(clearSpy).toHaveBeenCalledTimes(1)

      const refsAfter = await readEdgeRefsSnapshot(reader)
      expect(refsAfter.tags.map((t) => t.name)).toContain('v1.0.0')
      expect(refsAfter.branches.map((b) => b.name)).toContain('feat/no-checkout')

      await deleteEdgeTag(reader, 'v1.0.0')
      await deleteEdgeBranch(reader, 'feat/no-checkout')
      await createEdgeTag(reader, 'v1.0.1')
      await createEdgeBranch(reader, 'feat/tmp', undefined, false)
      const refsFinal = await readEdgeRefsSnapshot(reader)
      expect(refsFinal.tags.map((t) => t.name)).toEqual(['v1.0.1'])
      expect(refsFinal.branches.map((b) => b.name)).toEqual(['feat/tmp', 'main'])
      reader.dispose()
      driver.clearCache()
    } finally {
      g.FileSystemObserver = origObserver
    }
  })
})
