import { createTwoFilesPatch, diffLines } from 'diff'
import git from 'isomorphic-git'

import { GIT_WORKTREE_HASH, type GitCommitChanges, type GitFileChange, type GitWorktree } from '@/lib/git/types'

import { createDirectoryHandleFs } from './handle-fs'
import type { ReadCommitDiffOptions } from './types'

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const CONTENT_LIMIT = 2 * 1024 * 1024

/** Share pack indexes and immutable reads across clicks, with bounded result caches. */
export class EdgeRepositoryReader {
  readonly cache = {}
  readonly fs: ReturnType<typeof createDirectoryHandleFs>
  private readonly results = new Map<string, Promise<GitCommitChanges>>()
  private worktreeSnapshot?: GitFileChange[]

  constructor(readonly handle: FileSystemDirectoryHandle) {
    this.fs = createDirectoryHandleFs(handle)
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

  private async worktreeFiles(): Promise<GitFileChange[]> {
    // Never refresh the on-disk index: Edge requires read permission only.
    // Filter out bulky dependency and build directories to avoid thousands of FileSystem API IPC calls
    const ignoredTopDirs = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo', '.cache', 'coverage', '.temp'])
    const matrix = await git.statusMatrix({
      fs: this.fs,
      dir: '/',
      refresh: false,
      cache: this.cache,
      filter: (filepath) => {
        const top = filepath.split('/')[0]
        return !ignoredTopDirs.has(top)
      },
    })
    return matrix
      .filter(([, head, disk, stage]) => head !== disk || head !== stage)
      .map(([path, head, disk]) => ({ path, status: !head ? 'A' : !disk ? 'D' : 'M', oldPath: '' }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }

  async readWorktreeStatus(): Promise<GitWorktree | null> {
    try {
      const files = await this.worktreeFiles()
      this.worktreeSnapshot = files
      if (!files.length) return null
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
      return { files: files.length, insertions, deletions, addedFiles, deletedFiles, modifiedFiles }
    } catch {
      return null
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
