import git from 'isomorphic-git'

import type { EdgeRepositoryReader } from './edge-repository-reader'
import type { GitFetchOptions, GitPullOptions } from './types'

async function pathExistsOnDisk(reader: EdgeRepositoryReader, filepath: string): Promise<boolean> {
  try {
    await reader.fs.promises.stat(`/${filepath.replace(/^\/+/, '')}`)
    return true
  } catch {
    return false
  }
}

/**
 * Stage specific files or all dirty worktree paths using `reader.cache` and
 * observer-preserving incremental worktree refresh when a clean snapshot exists.
 */
export async function stageEdgeFiles(reader: EdgeRepositoryReader, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
  try {
    const { fs, cache } = reader
    if (all) {
      const snapshot = reader.peekWorktreeState()
      if (snapshot.canUseSnapshotForStageAll && snapshot.files) {
        const candidateSet = new Set([...snapshot.files.filter((f) => f.unstaged !== false).map((f) => f.path), ...snapshot.dirtyPaths])
        const candidates = [...candidateSet]
        if (!candidates.length) {
          return { ok: true, message: 'Changes staged' }
        }
        const addPaths: string[] = []
        const removePaths: string[] = []
        const knownDeleted = new Set(snapshot.files.filter((f) => f.status === 'D').map((f) => f.path))
        await Promise.all(
          candidates.map(async (filepath) => {
            if (knownDeleted.has(filepath) || !(await pathExistsOnDisk(reader, filepath))) {
              removePaths.push(filepath)
            } else {
              addPaths.push(filepath)
            }
          })
        )
        await reader.runInternalIndexWrite(async () => {
          if (addPaths.length > 0) {
            await git.add({ fs, dir: '/', filepath: addPaths, cache, parallel: true })
          }
          if (removePaths.length > 0) {
            await git.remove({ fs, dir: '/', filepath: removePaths, cache })
          }
          await reader.refreshWorktreePaths(candidates, { preserveObserver: true })
        })
        return { ok: true, message: 'Changes staged' }
      }

      const deletedFromSnapshot = (snapshot.files || []).filter((f) => f.status === 'D').map((f) => f.path)
      await reader.runInternalIndexWrite(async () => {
        await git.add({ fs, dir: '/', filepath: '.', cache, parallel: true })
        if (deletedFromSnapshot.length > 0) {
          await git.remove({ fs, dir: '/', filepath: deletedFromSnapshot, cache })
        }
      })
      reader.invalidateWorktree()
      return { ok: true, message: 'Changes staged' }
    }

    const paths = [...new Set((files || []).map((p) => p.replace(/^\/+/, '')).filter(Boolean))]
    if (!paths.length) {
      return { ok: true, message: 'Changes staged' }
    }

    const addPaths: string[] = []
    const removePaths: string[] = []
    await Promise.all(
      paths.map(async (filepath) => {
        if (await pathExistsOnDisk(reader, filepath)) {
          addPaths.push(filepath)
        } else {
          removePaths.push(filepath)
        }
      })
    )

    await reader.runInternalIndexWrite(async () => {
      if (addPaths.length > 0) {
        await git.add({ fs, dir: '/', filepath: addPaths, cache, parallel: true })
      }
      if (removePaths.length > 0) {
        await git.remove({ fs, dir: '/', filepath: removePaths, cache })
      }
      await reader.refreshWorktreePaths(paths, { preserveObserver: true })
    })
    return { ok: true, message: 'Changes staged' }
  } catch (err) {
    throw new Error(`Failed to stage: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Unstage specific files or all staged files using `reader.cache` while keeping
 * `FileSystemObserver` clean for the internal `.git/index` write.
 */
export async function unstageEdgeFiles(reader: EdgeRepositoryReader, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
  try {
    const { fs, cache } = reader
    const paths = all ? (await reader.worktreeFiles()).filter((f) => f.staged).map((f) => f.path) : [...new Set((files || []).map((p) => p.replace(/^\/+/, '')).filter(Boolean))]
    if (!paths.length) {
      return { ok: true, message: 'Changes unstaged' }
    }

    await reader.runInternalIndexWrite(async () => {
      for (const filepath of paths) {
        await git.resetIndex({ fs, dir: '/', filepath, cache })
      }
      await reader.refreshWorktreePaths(paths, { preserveObserver: true })
    })
    return { ok: true, message: 'Changes unstaged' }
  } catch (err) {
    throw new Error(`Failed to unstage: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Create a commit using cached object/index handles and invalidate only the worktree cache. */
export async function commitEdgeChanges(reader: EdgeRepositoryReader, message: string): Promise<{ ok: boolean; message: string; hash?: string }> {
  try {
    const sha = await reader.runInternalIndexWrite(() =>
      git.commit({
        fs: reader.fs,
        dir: '/',
        message,
        cache: reader.cache,
        author: { name: 'Edge User', email: 'edge@yggdrasil.local' },
      })
    )
    reader.invalidateWorktree()
    return { ok: true, message: 'Committed successfully', hash: sha }
  } catch (err) {
    throw new Error(`Failed to commit: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Read latest commit summary/body using reader cache. */
export async function readEdgeLastCommit(reader: EdgeRepositoryReader): Promise<{ summary: string; description: string }> {
  try {
    const [latest] = await git.log({ fs: reader.fs, dir: '/', depth: 1, cache: reader.cache })
    if (!latest) return { summary: '', description: '' }
    const lines = (latest.commit.message || '').split('\n')
    return { summary: lines[0] || '', description: lines.slice(1).join('\n').trim() }
  } catch {
    return { summary: '', description: '' }
  }
}

export async function pullEdgeRepo(reader: EdgeRepositoryReader, options?: GitPullOptions): Promise<{ ok: boolean; message: string }> {
  try {
    const http = (await import('isomorphic-git/http/web')).default
    await git.pull({
      fs: reader.fs,
      http,
      dir: '/',
      remote: options?.remote || 'origin',
      ref: options?.branch,
      singleBranch: true,
      fastForwardOnly: true,
      cache: reader.cache,
      author: { name: 'Edge User', email: 'edge@yggdrasil.local' },
    })
    reader.invalidateWorktree()
    return { ok: true, message: 'Pulled successfully' }
  } catch (error) {
    throw new Error(`Failed to pull: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function fetchEdgeRepo(reader: EdgeRepositoryReader, options?: GitFetchOptions): Promise<{ ok: boolean; message: string }> {
  try {
    const http = (await import('isomorphic-git/http/web')).default
    await git.fetch({
      fs: reader.fs,
      http,
      dir: '/',
      remote: options?.remote || 'origin',
      prune: options?.prune !== false,
      tags: true,
      cache: reader.cache,
    })
    return { ok: true, message: 'Fetch completed' }
  } catch (error) {
    throw new Error(`Failed to fetch: ${error instanceof Error ? error.message : String(error)}`)
  }
}
