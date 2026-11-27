import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import git from 'isomorphic-git'

import { EdgeGitDriver } from '@/lib/git/driver/edge-driver'
import { EdgeRepositoryReader } from '@/lib/git/driver/edge-repository-reader'
import { getDirectoryHandle } from '@/lib/git/indexeddb-handles'

jest.mock('@/lib/git/indexeddb-handles', () => ({
  getDirectoryHandle: jest.fn(),
}))

describe('Edge repository reads against a packed Git repository', () => {
  let directory: string
  let first: string
  let head: string
  let fileReads: number
  let reader: EdgeRepositoryReader

  function command(...args: string[]) {
    return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', directory, ...args], { encoding: 'utf8' }).trim()
  }

  function handle(directoryPath: string): FileSystemDirectoryHandle {
    return {
      name: path.basename(directoryPath),
      kind: 'directory',
      async getDirectoryHandle(name: string) {
        const entry = path.join(directoryPath, name)
        if (!(await fs.stat(entry)).isDirectory()) throw new Error('Not a directory')
        return handle(entry)
      },
      async getFileHandle(name: string) {
        const entry = path.join(directoryPath, name)
        if (!(await fs.stat(entry)).isFile()) throw new Error('Not a file')
        return {
          async getFile() {
            const stat = await fs.stat(entry)
            return {
              size: stat.size,
              lastModified: stat.mtimeMs,
              async arrayBuffer() {
                fileReads++
                return Uint8Array.from(await fs.readFile(entry)).buffer
              },
              async text() {
                fileReads++
                return fs.readFile(entry, 'utf8')
              },
            }
          },
        }
      },
      async *keys() {
        yield* await fs.readdir(directoryPath)
      },
    } as unknown as FileSystemDirectoryHandle
  }

  beforeAll(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yggit-edge-read-'))
    command('init', '-q')
    command('config', 'user.name', 'Test')
    command('config', 'user.email', 'test@example.invalid')
    await fs.mkdir(path.join(directory, '中文目录'))
    await fs.writeFile(path.join(directory, '中文目录', 'space #file.txt'), 'before\nsame\n')
    await fs.writeFile(path.join(directory, 'deleted.txt'), 'removed\n')
    await fs.writeFile(path.join(directory, 'binary.bin'), new Uint8Array([1, 0, 2]))
    await fs.mkdir(path.join(directory, 'unchanged'))
    await fs.writeFile(path.join(directory, 'unchanged', 'stable.txt'), 'stable\n')
    command('add', '.')
    command('commit', '-qm', 'first')
    first = command('rev-parse', 'HEAD')
    await fs.writeFile(path.join(directory, '中文目录', 'space #file.txt'), 'after\nsame\n')
    await fs.unlink(path.join(directory, 'deleted.txt'))
    command('add', '.')
    command('commit', '-qm', 'second')
    head = command('rev-parse', 'HEAD')
    command('repack', '-ad')
    // The working copy must never substitute for a historical blob.
    await fs.writeFile(path.join(directory, '中文目录', 'space #file.txt'), 'uncommitted\n')
  })

  afterAll(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })

  beforeEach(() => {
    fileReads = 0
    reader = new EdgeRepositoryReader(handle(directory))
  })

  it('reads root additions, changed files, and the complete tree', async () => {
    const root = await reader.readChanges({ repo: 'edge', hash: first, tree: true })
    expect(root.files).toHaveLength(4)
    expect(root.files.every((file) => file.status === 'A')).toBe(true)
    const changed = await reader.readChanges({ repo: 'edge', hash: head, tree: true })
    expect(changed.files).toEqual(
      expect.arrayContaining([
        { path: 'deleted.txt', status: 'D', oldPath: '' },
        { path: '中文目录/space #file.txt', status: 'M', oldPath: '' },
      ])
    )
    expect(changed.files).toHaveLength(2)
    const all = await reader.readChanges({ repo: 'edge', hash: head, tree: true, all: true })
    expect(all.files.find((file) => file.path === 'unchanged/stable.txt')).toBeDefined()
  })

  it('reads only the chosen path, returns historical content and a real patch', async () => {
    const walk = jest.spyOn(git, 'walk')
    const result = await reader.readChanges({ repo: 'edge', hash: head, file: '中文目录/space #file.txt' })
    expect(walk).not.toHaveBeenCalled()
    expect(result.content).toBe('after\nsame\n')
    expect(result.patch).toContain('-before\n+after')
    expect(result.patch).toContain('@@')
    expect(result.contentMissing).toBe(false)
    expect(result.truncated).toBe(false)
  })

  it('coalesces concurrent reads and reopens cached content without disk reads', async () => {
    const options = { repo: 'edge', hash: head, file: '中文目录/space #file.txt' }
    const pending = reader.readChanges(options)
    expect(reader.readChanges(options)).toBe(pending)
    await pending
    const reads = fileReads
    expect(reads).toBeGreaterThan(0)
    await reader.readChanges(options)
    expect(fileReads).toBe(reads)
  })

  it('distinguishes removed files, binary blobs, and a missing path', async () => {
    const removed = await reader.readChanges({ repo: 'edge', hash: head, file: 'deleted.txt' })
    expect(removed.contentMissing).toBe(true)
    expect(removed.patch).toContain('-removed')
    const binary = await reader.readChanges({ repo: 'edge', hash: first, file: 'binary.bin' })
    expect(binary.contentBinary).toBe(true)
    expect(binary.patch).toBe('')
    await expect(reader.readChanges({ repo: 'edge', hash: head, file: 'not-found.txt' })).rejects.toThrow('File not found')
    await expect(reader.readBlob(head, 'not-found.txt')).rejects.toThrow('File not found')
  })

  it('evicts failed reads so a later attempt can recover', async () => {
    const read = jest.spyOn(git, 'readCommit').mockRejectedValueOnce(new Error('transient read failure'))
    const options = { repo: 'edge', hash: head, tree: true }
    await expect(reader.readChanges(options)).rejects.toThrow('transient')
    expect((await reader.readChanges(options)).files).toHaveLength(2)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('matches native Git dirty paths and reads live files without rewriting the index', async () => {
    await fs.writeFile(path.join(directory, '.gitignore'), 'ignored/\n')
    await fs.mkdir(path.join(directory, 'ignored'), { recursive: true })
    await fs.writeFile(path.join(directory, 'ignored', 'hidden.txt'), 'ignored\n')
    await fs.writeFile(path.join(directory, 'staged.txt'), 'staged\n')
    command('add', 'staged.txt')
    await fs.writeFile(path.join(directory, 'staged.txt'), 'staged and changed\n')
    await fs.unlink(path.join(directory, 'unchanged', 'stable.txt'))
    const indexPath = path.join(directory, '.git', 'index')
    const originalIndex = await fs.readFile(indexPath)
    const originalStat = await fs.stat(indexPath)
    try {
      const expected = [
        ...new Set(
          execFileSync('git', ['-C', directory, 'ls-files', '-z', '--modified', '--others', '--exclude-standard'], { encoding: 'utf8' })
            .split('\0')
            .filter(Boolean)
            .concat('staged.txt')
        ),
      ].sort()
      const changes = await reader.readChanges({ repo: 'edge', hash: 'WORKTREE', all: true })
      expect(changes.files.map((file) => file.path).sort()).toEqual(expected)
      expect(changes.files).toContainEqual({ path: 'unchanged/stable.txt', status: 'D', oldPath: '', staged: false, unstaged: true })
      const status = await reader.readWorktreeStatus()
      expect(status).toEqual({ files: expected.length, insertions: 3, deletions: 3, addedFiles: 2, deletedFiles: 1, modifiedFiles: 1 })
      const modified = await reader.readChanges({ repo: 'edge', hash: 'WORKTREE', file: '中文目录/space #file.txt' })
      expect(modified.content).toBe('uncommitted\n')
      expect(modified.patch).toContain('-after')
      const staged = await reader.readChanges({ repo: 'edge', hash: 'WORKTREE', file: 'staged.txt' })
      expect(staged.patch).toContain('+staged and changed')
      const deleted = await reader.readChanges({ repo: 'edge', hash: 'WORKTREE', file: 'unchanged/stable.txt' })
      expect(deleted.contentMissing).toBe(true)
      expect((await reader.readBlob('WORKTREE', 'staged.txt')).content).toBe('staged and changed\n')
      await fs.writeFile(path.join(directory, 'staged.txt'), 'live\n')
      expect((await reader.readChanges({ repo: 'edge', hash: 'WORKTREE', file: 'staged.txt' })).content).toBe('live\n')
      expect(await fs.readFile(indexPath)).toEqual(originalIndex)
      expect((await fs.stat(indexPath)).mtimeMs).toBe(originalStat.mtimeMs)
    } finally {
      command('reset', '-q', 'HEAD', '--', 'staged.txt')
      await fs.rm(path.join(directory, 'staged.txt'), { force: true })
      await fs.rm(path.join(directory, '.gitignore'), { force: true })
      await fs.rm(path.join(directory, 'ignored'), { recursive: true, force: true })
      await fs.writeFile(path.join(directory, 'unchanged', 'stable.txt'), 'stable\n')
    }
  })

  it('pages past 100 local commits without duplicates and reports the final page', async () => {
    const tree = command('rev-parse', `${head}^{tree}`)
    let tip = head
    for (let i = 0; i < 105; i++) tip = command('commit-tree', tree, '-p', tip, '-m', `history ${i}`)
    command('update-ref', 'refs/heads/pagination-test', tip)
    jest.mocked(getDirectoryHandle).mockResolvedValue(handle(directory))
    const driver = new EdgeGitDriver()
    const hashes: string[] = []
    let hasMore = true
    while (hasMore) {
      const page = await driver.readLog({ repo: 'edge-fixture', branch: 'pagination-test', skip: hashes.length })
      expect(page.commits.length).toBeGreaterThan(0)
      expect(page.commits.length).toBeLessThanOrEqual(40)
      hashes.push(...page.commits.map((commit) => commit.hash))
      hasMore = page.hasMore
      expect(hashes.length).toBeLessThanOrEqual(107)
    }
    expect(hashes).toHaveLength(107)
    expect(new Set(hashes).size).toBe(107)
    expect(hashes[0]).toBe(tip)
    expect(hashes.at(-1)).toBe(first)
    await expect(driver.readLog({ repo: 'edge-fixture', branch: 'missing-ref' })).rejects.toThrow()
  }, 8000)

  it('keeps staged changes visible even when the disk content is restored to HEAD', async () => {
    const file = path.join(directory, '中文目录', 'space #file.txt')
    try {
      await fs.writeFile(file, 'staged version\n')
      command('add', '中文目录/space #file.txt')
      await fs.writeFile(file, 'after\nsame\n')
      expect((await reader.readChanges({ repo: 'edge', hash: 'WORKTREE' })).files).toEqual([
        { path: '中文目录/space #file.txt', status: 'M', oldPath: '', staged: true, unstaged: true },
      ])
      expect((await reader.readWorktreeStatus())?.files).toBe(1)
    } finally {
      command('reset', '-q', 'HEAD', '--', '中文目录/space #file.txt')
      await fs.writeFile(file, 'uncommitted\n')
    }
  })

  it('reads untracked changes in a repository with no commits', async () => {
    const unborn = await fs.mkdtemp(path.join(os.tmpdir(), 'yggit-edge-unborn-'))
    try {
      execFileSync('git', ['-C', unborn, 'init', '-q'])
      await fs.writeFile(path.join(unborn, 'new.txt'), 'first\n')
      const fresh = new EdgeRepositoryReader(handle(unborn))
      expect(await fresh.readWorktreeStatus()).toEqual({ files: 1, insertions: 1, deletions: 0, addedFiles: 1, deletedFiles: 0, modifiedFiles: 0 })
      expect((await fresh.readChanges({ repo: 'edge', hash: 'WORKTREE', file: 'new.txt' })).patch).toContain('+first')
    } finally {
      await fs.rm(unborn, { recursive: true, force: true })
    }
  })

  it('coalesces concurrent worktree scans, prunes heavy ignored directories, and supports incremental single-path stage/unstage', async () => {
    const heavyDir = path.join(directory, 'node_modules', 'pkg')
    await fs.mkdir(heavyDir, { recursive: true })
    await fs.writeFile(path.join(heavyDir, 'index.js'), 'module.exports = 1\n')

    const readdirCalls: string[] = []
    const originalReaddir = reader.fs.promises.readdir.bind(reader.fs.promises)
    jest.spyOn(reader.fs.promises, 'readdir').mockImplementation(async (dirpath: string) => {
      readdirCalls.push(dirpath)
      return originalReaddir(dirpath)
    })

    try {
      const p1 = reader.worktreeFiles()
      const p2 = reader.worktreeFiles()
      expect(p1).toBe(p2)
      const files = await p1
      expect(files.some((f) => f.path.startsWith('node_modules'))).toBe(false)
      expect(readdirCalls.some((d) => d.includes('node_modules'))).toBe(false)

      command('add', '中文目录/space #file.txt')
      readdirCalls.length = 0
      await reader.refreshWorktreePaths(['中文目录/space #file.txt'])
      const afterStage = await reader.readChanges({ repo: 'edge', hash: 'WORKTREE' })
      expect(afterStage.files).toEqual([{ path: '中文目录/space #file.txt', status: 'M', oldPath: '', staged: true, unstaged: false }])
      expect(readdirCalls.some((d) => d.includes('unchanged') || d.includes('node_modules'))).toBe(false)

      // Clean files whose mtime precedes .git/index by >2s must NOT incur byte reads during worktreeFiles()
      const stableFile = path.join(directory, 'unchanged', 'stable.txt')
      const past = new Date(Date.now() - 10_000)
      await fs.utimes(stableFile, past, past)
      command('reset', '-q', 'HEAD', '--', '中文目录/space #file.txt')
      await fs.writeFile(path.join(directory, '中文目录', 'space #file.txt'), 'after\nsame\n')
      await fs.utimes(path.join(directory, '中文目录', 'space #file.txt'), past, past)
      command('update-index', '--refresh')
      // Ensure .git/index mtime is >=2s newer than tracked files
      const futureIndex = new Date(Date.now() + 5_000)
      await fs.utimes(path.join(directory, '.git', 'index'), futureIndex, futureIndex)

      reader.invalidateWorktree()
      const readPaths: string[] = []
      const origReadFile = reader.fs.promises.readFile.bind(reader.fs.promises)
      jest.spyOn(reader.fs.promises, 'readFile').mockImplementation((filepath: string, opts?: unknown) => {
        if (typeof filepath === 'string') readPaths.push(filepath)
        return origReadFile(filepath, opts)
      })
      const cleanScan = await reader.worktreeFiles()
      expect(cleanScan).toEqual([])
      expect(readPaths.filter((p) => !p.includes('/.git/') && !p.endsWith('/.gitignore'))).toEqual([])
    } finally {
      command('reset', '-q', 'HEAD', '--', '中文目录/space #file.txt')
      await fs.writeFile(path.join(directory, '中文目录', 'space #file.txt'), 'uncommitted\n')
      await fs.rm(path.join(directory, 'node_modules'), { recursive: true, force: true })
    }
  })
})
