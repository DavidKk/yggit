import { createTwoFilesPatch, diffLines } from 'diff'
import git from 'isomorphic-git'

import { GIT_WORKTREE_HASH, type GitCommitChanges, type GitFileChange, type GitWorktree } from '@/lib/git/types'

import { createDirectoryHandleFs } from './handle-fs'
import type { ReadCommitDiffOptions } from './types'

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const CONTENT_LIMIT = 2 * 1024 * 1024
const IGNORED_WORKTREE_TOP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo', '.cache', 'coverage', '.temp', '.playwright-mcp', 'test-results'])
const PRUNED_WORKTREE_REFS_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.cache', 'coverage', '.temp', '.playwright-mcp', 'test-results'])

function mapStatusMatrixRows(matrix: Array<[string, number, number, number]>): GitFileChange[] {
  return matrix
    .filter(([, head, disk, stage]) => head !== disk || head !== stage)
    .map(([path, head, disk, stage]) => ({
      path,
      status: (!head ? 'A' : !disk ? 'D' : 'M') as GitFileChange['status'],
      oldPath: '',
      staged: stage !== head,
      unstaged: disk !== stage,
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Share pack indexes and immutable reads across clicks, with bounded result caches. */
export class EdgeRepositoryReader {
  readonly cache = {}
  readonly fs: ReturnType<typeof createDirectoryHandleFs>
  private readonly results = new Map<string, Promise<GitCommitChanges>>()
  private worktreeSnapshot?: GitFileChange[]
  private worktreeInFlight?: Promise<GitFileChange[]>
  private lastWorktreeStatus?: GitWorktree | null
  private observer?: { disconnect: () => void }
  private observerStarted = false
  private observerClean = false
  private readonly observerDirtyPaths = new Set<string>()

  constructor(readonly handle: FileSystemDirectoryHandle) {
    this.fs = createDirectoryHandleFs(handle)
  }

  dispose(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.observerStarted = false
    this.observerClean = false
    this.observerDirtyPaths.clear()
  }

  invalidateWorktree(): void {
    this.worktreeSnapshot = undefined
    this.worktreeInFlight = undefined
    this.observerClean = false
    this.observerDirtyPaths.clear()
    this.fs.clearCache()
  }

  readChanges(options: ReadCommitDiffOptions): Promise<GitCommitChanges> {
    const key = JSON.stringify([options.hash, options.tree, options.all, options.file])
    if (!/^[a-f0-9]{40}$/i.test(options.hash)) return this.loadChanges(options)
    const hit = this.results.get(key)
    if (hit) {
      this.results.delete(key)
      this.results.set(key, hit)
      return hit
    }
    const pending = this.loadChanges(options).catch((error) => {
      if (this.results.get(key) === pending) this.results.delete(key)
      throw error
    })
    this.results.set(key, pending)
    if (this.results.size > 8) this.results.delete(this.results.keys().next().value!)
    return pending
  }

  private async blob(hash: string, path: string): Promise<Uint8Array | null> {
    let oid = hash
    const parts = path.split('/').filter(Boolean)
    for (let index = 0; index < parts.length; index++) {
      const { tree } = await git.readTree({ fs: this.fs, dir: '/', oid, cache: this.cache })
      const entry = tree.find((item) => item.path === parts[index])
      if (!entry) return null
      if (index < parts.length - 1 && entry.type !== 'tree') return null
      if (index === parts.length - 1 && entry.type !== 'blob') return null
      oid = entry.oid
    }
    return (await git.readBlob({ fs: this.fs, dir: '/', oid, cache: this.cache })).blob
  }

  private async diskBlob(path: string): Promise<Uint8Array | null> {
    try {
      return (await this.fs.promises.readFile(`/${path}`)) as Uint8Array
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null
      throw error
    }
  }

  private async head(): Promise<string | undefined> {
    try {
      return await git.resolveRef({ fs: this.fs, dir: '/', ref: 'HEAD' })
    } catch (error) {
      if ((error as { code?: string }).code === 'NotFoundError') return undefined
      throw error
    }
  }

  private ensureObserver(): void {
    if (this.observerStarted) return
    this.observerStarted = true
    const ObserverCtor = (
      globalThis as unknown as {
        FileSystemObserver?: new (cb: (records: Array<{ type?: string; relativePathComponents?: string[] }>) => void) => {
          observe: (handle: FileSystemDirectoryHandle, opts?: { recursive?: boolean }) => Promise<void>
          disconnect: () => void
        }
      }
    ).FileSystemObserver
    if (typeof ObserverCtor !== 'function') return

    try {
      const observer = new ObserverCtor((records) => {
        for (const rec of records) {
          const parts = rec.relativePathComponents
          if (!parts || parts.length === 0 || rec.type === 'unknown' || rec.type === 'errored') {
            this.observerClean = false
            this.observerDirtyPaths.clear()
            return
          }
          const top = parts[0]
          if (PRUNED_WORKTREE_REFS_DIRS.has(top)) continue
          const relPath = parts.join('/')
          if (top === '.git') {
            if (relPath === '.git/index' || relPath === '.git/HEAD' || relPath.startsWith('.git/refs/')) {
              this.observerClean = false
              this.observerDirtyPaths.clear()
              return
            }
            continue
          }
          this.observerDirtyPaths.add(relPath)
        }
      })
      this.observer = observer
      void observer
        .observe(this.handle, { recursive: true })
        .then(() => {
          this.observerClean = true
        })
        .catch(() => {
          this.observerClean = false
        })
    } catch {
      this.observerClean = false
    }
  }

  worktreeFiles(): Promise<GitFileChange[]> {
    if (this.worktreeInFlight) return this.worktreeInFlight

    if (this.observerClean && this.worktreeSnapshot) {
      if (this.observerDirtyPaths.size === 0) {
        return Promise.resolve(this.worktreeSnapshot)
      }
      const dirty = [...this.observerDirtyPaths]
      this.observerDirtyPaths.clear()
      return this.refreshWorktreePaths(dirty).then(() => this.worktreeSnapshot || [])
    }

    const scan = (async () => {
      this.fs.clearCache()
      const gitignoreCache = new Map<string, Promise<Uint8Array | string>>()
      // Prune heavy build/dependency directories in readdir before isomorphic-git stats their children,
      // while preserving `/.git` access and caching `.gitignore` reads during the walk.
      const prunedFs = {
        promises: {
          ...this.fs.promises,
          readFile: (filepath: string, opts?: unknown) => {
            if (typeof filepath === 'string' && (filepath.endsWith('/.gitignore') || filepath === '.gitignore')) {
              const key = `${filepath}:${typeof opts === 'string' ? opts : JSON.stringify(opts || '')}`
              const hit = gitignoreCache.get(key)
              if (hit) return hit
              const p = this.fs.promises.readFile(filepath, opts)
              gitignoreCache.set(key, p)
              return p
            }
            return this.fs.promises.readFile(filepath, opts)
          },
          readdir: async (dirpath: string): Promise<string[]> => {
            const top = typeof dirpath === 'string' ? dirpath.replace(/^\/+/, '').split('/')[0] : ''
            if (top && PRUNED_WORKTREE_REFS_DIRS.has(top)) {
              return []
            }
            return this.fs.promises.readdir(dirpath)
          },
        },
      }

      const indexMtimeMs = await this.fs.promises
        .stat('/.git/index')
        .then((s) => s.mtimeMs)
        .catch(() => 0)

      const raw = (await git.walk({
        fs: prunedFs,
        dir: '/',
        cache: this.cache,
        trees: [git.TREE({ ref: 'HEAD' }), git.WORKDIR({ refresh: false }), git.STAGE()],
        map: async (filepath, [head, workdir, stage]) => {
          if (filepath === '.') return undefined
          const top = filepath.split('/')[0]
          if (IGNORED_WORKTREE_TOP_DIRS.has(top)) return null

          if (!head && !stage && workdir) {
            const ignored = await git.isIgnored({ fs: prunedFs, dir: '/', filepath })
            if (ignored) return null
          }

          const [headType, workdirType, stageType] = await Promise.all([head && head.type(), workdir && workdir.type(), stage && stage.type()])
          const isBlob = headType === 'blob' || workdirType === 'blob' || stageType === 'blob'
          if (!isBlob) {
            if (headType === 'commit' || stageType === 'commit') return null
            return undefined
          }

          const headOid = headType === 'blob' ? await head!.oid() : undefined
          const stageOid = stageType === 'blob' ? await stage!.oid() : undefined
          let workdirOid: string | undefined

          if (workdirType !== 'blob') {
            workdirOid = undefined
          } else if (headType !== 'blob' && stageType !== 'blob') {
            workdirOid = '42'
          } else if (stageType === 'blob') {
            // Browser FileSystemHandle omits POSIX ino/uid/gid/ctime, which causes isomorphic-git's
            // compareStats to hash 100% of tracked files. Compare browser-exposed size + mtime instead.
            const [stageStat, diskStat] = await Promise.all([stage!.stat(), workdir!.stat()])
            const sameSize = diskStat.size === stageStat.size
            const sameMtime = diskStat.mtimeSeconds === stageStat.mtimeSeconds
            const diskMtimeMs = diskStat.mtimeSeconds * 1000 + Math.floor((diskStat.mtimeNanoseconds || 0) / 1e6)
            const notRacy = indexMtimeMs > 0 && diskMtimeMs < indexMtimeMs - 2000
            workdirOid = sameSize && sameMtime && notRacy ? stageOid : await workdir!.oid()
          } else {
            workdirOid = await workdir!.oid()
          }

          if (headOid === workdirOid && headOid === stageOid) return undefined

          return {
            path: filepath,
            status: (!headOid ? 'A' : !workdirOid ? 'D' : 'M') as GitFileChange['status'],
            oldPath: '',
            staged: stageOid !== headOid,
            unstaged: workdirOid !== stageOid,
          }
        },
      })) as GitFileChange[]

      const files = raw.sort((a, b) => a.path.localeCompare(b.path))
      this.worktreeSnapshot = files
      this.ensureObserver()
      if (this.observer) this.observerClean = true
      return files
    })()

    this.worktreeInFlight = scan.finally(() => {
      if (this.worktreeInFlight === scan) {
        this.worktreeInFlight = undefined
      }
    })
    return this.worktreeInFlight
  }

  async refreshWorktreePaths(paths: string[]): Promise<void> {
    const cleanPaths = [...new Set(paths.map((p) => p.replace(/^\/+/, '')).filter(Boolean))]
    if (!cleanPaths.length || !this.worktreeSnapshot) {
      this.invalidateWorktree()
      return
    }
    const allowedDirs = new Set<string>(['', '.'])
    for (const p of cleanPaths) {
      const parts = p.split('/')
      let acc = ''
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i]
        allowedDirs.add(acc)
      }
    }
    const targetedFs = {
      promises: {
        ...this.fs.promises,
        readdir: async (dirpath: string): Promise<string[]> => {
          const clean = typeof dirpath === 'string' ? dirpath.replace(/^\/+|\/+$/g, '') : ''
          if (clean === '.git' || clean.startsWith('.git/') || allowedDirs.has(clean)) {
            return this.fs.promises.readdir(dirpath)
          }
          return []
        },
      },
    }
    const matrix = await git.statusMatrix({
      fs: targetedFs,
      dir: '/',
      filepaths: cleanPaths,
      refresh: false,
      cache: this.cache,
      filter: (filepath) => cleanPaths.includes(filepath),
    })
    const updated = mapStatusMatrixRows(matrix)
    const targetSet = new Set(cleanPaths)
    const merged = this.worktreeSnapshot.filter((f) => !targetSet.has(f.path))
    merged.push(...updated)
    merged.sort((a, b) => a.path.localeCompare(b.path))
    this.worktreeSnapshot = merged
  }

  getLastWorktreeStatus(): GitWorktree | null | undefined {
    return this.lastWorktreeStatus
  }

  async readWorktreeStatus(): Promise<GitWorktree | null> {
    try {
      const files = await this.worktreeFiles()
      this.worktreeSnapshot = files
      if (!files.length) {
        this.lastWorktreeStatus = null
        return null
      }
      const head = await this.head()
      let insertions = 0
      let deletions = 0
      // Limit diff calculation to first 25 files to preserve snappy UI rendering
      const diffSample = files.slice(0, 25)
      for (const file of diffSample) {
        const [before, after] = await Promise.all([head ? this.blob(head, file.path) : null, this.diskBlob(file.path)])
        if ([before, after].some((blob) => blob && (blob.byteLength > CONTENT_LIMIT || blob.subarray(0, 8000).includes(0)))) continue
        const changes = diffLines(new TextDecoder().decode(before || new Uint8Array()), new TextDecoder().decode(after || new Uint8Array()), { timeout: 80, maxEditLength: 10000 })
        for (const change of changes || []) {
          if (change.added) insertions += change.count || 0
          if (change.removed) deletions += change.count || 0
        }
      }
      let addedFiles = 0
      let deletedFiles = 0
      let modifiedFiles = 0
      for (const file of files) {
        if (file.status === 'A' || file.status === '?' || file.status === 'U') addedFiles++
        else if (file.status === 'D') deletedFiles++
        else modifiedFiles++
      }
      const summary = { files: files.length, insertions, deletions, addedFiles, deletedFiles, modifiedFiles }
      this.lastWorktreeStatus = summary
      return summary
    } catch {
      return this.lastWorktreeStatus ?? null
    }
  }

  async readBlob(hash: string, path: string): Promise<{ content: string; binary: boolean }> {
    const blob = hash === GIT_WORKTREE_HASH ? await this.diskBlob(path) : await this.blob(hash, path)
    if (!blob) throw new Error(`File not found at commit ${hash}: ${path}`)
    const binary = blob.subarray(0, 8000).includes(0)
    return { content: binary ? '' : new TextDecoder().decode(blob), binary }
  }

  private async loadChanges(options: ReadCommitDiffOptions): Promise<GitCommitChanges> {
    const { hash, file, all } = options
    const { fs, cache } = this
    const worktree = hash === GIT_WORKTREE_HASH
    // Reuse the history refresh's file list; selected file bytes always come from disk.
    if (worktree && !file) return { hash, files: this.worktreeSnapshot || (await this.worktreeFiles()), patch: '', truncated: false }
    const parent = worktree ? await this.head() : (await git.readCommit({ fs, dir: '/', oid: hash, cache })).commit.parent[0]
    if (file) {
      // Resolve only the selected path instead of walking the repository again.
      const [before, after] = await Promise.all([parent ? this.blob(parent, file) : null, worktree ? this.diskBlob(file) : this.blob(hash, file)])
      if (!before && !after) throw new Error(`File not found at commit ${hash}: ${file}`)
      const binary = [before, after].some((blob) => blob?.subarray(0, 8000).includes(0))
      const contentTruncated = Boolean(after && after.byteLength > CONTENT_LIMIT)
      const oversized = contentTruncated || Boolean(before && before.byteLength > CONTENT_LIMIT)
      const content = after && !binary ? new TextDecoder().decode(after.subarray(0, CONTENT_LIMIT)) : undefined
      const patch =
        binary || oversized
          ? ''
          : createTwoFilesPatch(
              before ? `a/${file}` : '/dev/null',
              after ? `b/${file}` : '/dev/null',
              new TextDecoder().decode(before || new Uint8Array()),
              content || '',
              '',
              '',
              {
                context: 3,
                timeout: 100,
                maxEditLength: 20000,
              }
            )
      return {
        hash,
        files: [],
        patch: patch?.slice(0, CONTENT_LIMIT) || '',
        truncated: oversized || patch === undefined || Boolean(patch && patch.length > CONTENT_LIMIT),
        content,
        contentBinary: binary,
        contentMissing: !after,
        contentTruncated,
      }
    }

    const files: GitFileChange[] = []
    await git.walk({
      fs,
      dir: '/',
      cache,
      trees: [git.TREE({ ref: parent || EMPTY_TREE }), git.TREE({ ref: hash })],
      map: async (path, [before, after]) => {
        const [beforeOid, afterOid] = await Promise.all([before?.oid(), after?.oid()])
        if (!all && beforeOid === afterOid) return null
        const [beforeType, afterType] = await Promise.all([before?.type(), after?.type()])
        if (beforeType === 'tree' || afterType === 'tree') return
        if (beforeType === 'commit' || afterType === 'commit') return
        const status = !before ? 'A' : !after ? 'D' : beforeOid !== afterOid ? 'M' : ''
        files.push({ path, status, oldPath: '' })
      },
    })
    files.sort((a, b) => a.path.localeCompare(b.path))
    return { hash, files, patch: '', truncated: false }
  }
}
