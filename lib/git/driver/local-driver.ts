import { readApiErrorMessage } from '@/lib/api-error'
import { GIT_WORKTREE_HASH, type GitCommit, type GitCommitChanges, type GitLogView, type GitProjectCatalog, type GitProjectView, type GitRemoteSource } from '@/lib/git/types'
import { runWithForegroundPriority } from '@/lib/workdesk/scheduler'

import type {
  AddProjectPayload,
  AddRemoteProjectOptions,
  GitBlameLine,
  GitCheckoutOptions,
  GitCommitOptions,
  GitDeleteFolderResult,
  GitFetchOptions,
  GitPullOptions,
  GitPushOptions,
  GitStashOptions,
  IGitDriver,
  ReadBlobOptions,
  ReadCommitDiffOptions,
  ReadLogOptions,
  SearchLogOptions,
} from './types'

const inFlightRequests = new Map<string, Promise<unknown>>()
const commitDiffClientCache = new Map<string, GitCommitChanges>()
const MAX_CLIENT_CACHE = 200

export class LocalGitDriver implements IGitDriver {
  readonly mode = 'local' as const

  clearCache(_repo?: string): void {
    commitDiffClientCache.clear()
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return true
    try {
      const res = await fetch('/api/git/projects', { method: 'HEAD' })
      return res.ok || res.status === 404 || res.status === 405
    } catch {
      return false
    }
  }

  async readLog(options: ReadLogOptions): Promise<GitLogView> {
    const params = new URLSearchParams()
    if (options.repo) params.set('repo', options.repo)
    if (options.branch) params.set('branch', options.branch)
    if (options.ref) params.set('ref', options.ref)
    if (options.skip !== undefined) params.set('skip', String(options.skip))
    if (options.take !== undefined) params.set('take', String(options.take))
    if (options.locate) params.set('locate', options.locate)

    const url = `/api/git/log?${params.toString()}`
    const res = options.signal ? await fetch(url, { signal: options.signal }) : await fetch(url)
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null)
      throw new Error(readApiErrorMessage(body, `Failed to read git log (${res.status})`))
    }
    return (await res.json()) as GitLogView
  }

  async searchLog(options: SearchLogOptions): Promise<{ commits: GitCommit[] }> {
    const params = new URLSearchParams()
    if (options.repo) params.set('repo', options.repo)
    if (options.query) params.set('q', options.query)
    if (options.ref) params.set('ref', options.ref)
    if (options.branch) params.set('branch', options.branch)
    if (options.limit !== undefined) params.set('take', String(options.limit))

    const res = await fetch(`/api/git/log?${params.toString()}`)
    if (!res.ok) {
      return { commits: [] }
    }
    const data = (await res.json()) as { commits?: GitCommit[] }
    return { commits: data.commits || [] }
  }

  async readCommitDiff(options: ReadCommitDiffOptions): Promise<GitCommitChanges> {
    const isImmutable = Boolean(options.hash && options.hash !== GIT_WORKTREE_HASH)
    const cacheKey = isImmutable ? `commit:${options.repo || ''}:${options.hash}:${options.tree ? '1' : '0'}:${options.file || ''}:${options.all ? '1' : '0'}` : null

    if (cacheKey && commitDiffClientCache.has(cacheKey)) {
      return commitDiffClientCache.get(cacheKey)!
    }

    if (cacheKey && inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<GitCommitChanges>
    }

    const params = new URLSearchParams()
    if (options.repo) params.set('repo', options.repo)
    if (options.hash) params.set('hash', options.hash)
    if (options.tree) params.set('tree', '1')
    if (options.file) params.set('path', options.file)
    if (options.all) params.set('all', '1')

    const fetchPromise = runWithForegroundPriority(async () => {
      const res = await fetch(`/api/git/commit?${params.toString()}`)
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null)
        throw new Error(readApiErrorMessage(body, `Failed to read commit diff (${res.status})`))
      }
      const data = (await res.json()) as GitCommitChanges
      if (cacheKey) {
        if (commitDiffClientCache.size >= MAX_CLIENT_CACHE) {
          const firstKey = commitDiffClientCache.keys().next().value
          if (firstKey) commitDiffClientCache.delete(firstKey)
        }
        commitDiffClientCache.set(cacheKey, data)
      }
      return data
    }).finally(() => {
      if (cacheKey) inFlightRequests.delete(cacheKey)
    })

    if (cacheKey) inFlightRequests.set(cacheKey, fetchPromise)
    return fetchPromise
  }

  async readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }> {
    const params = new URLSearchParams()
    if (options.repo) params.set('repo', options.repo)
    if (options.hash) params.set('hash', options.hash)
    if (options.path) params.set('path', options.path)

    const res = await fetch(`/api/git/blob?${params.toString()}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Failed to read blob (${res.status})`)
    }

    const binaryHeader = res.headers?.get('x-git-binary')
    const contentType = res.headers?.get('content-type') || ''
    const isBinary =
      binaryHeader === '1'
        ? true
        : binaryHeader === '0'
          ? false
          : Boolean(contentType) && !contentType.startsWith('text/') && !contentType.includes('json') && !contentType.includes('javascript') && !contentType.includes('xml')
    const text = await res.text()
    return {
      content: text,
      binary: isBinary,
    }
  }

  async readBlame(options: { repo: string; path: string; hash?: string }): Promise<Record<number, GitBlameLine>> {
    const isImmutable = Boolean(options.hash && options.hash !== GIT_WORKTREE_HASH)
    const cacheKey = isImmutable ? `blame:${options.repo}:${options.hash}:${options.path}` : null

    if (cacheKey && inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<Record<number, GitBlameLine>>
    }

    const params = new URLSearchParams()
    if (options.repo) params.set('repo', options.repo)
    if (options.path) params.set('path', options.path)
    if (options.hash) params.set('hash', options.hash)

    const fetchPromise = (async () => {
      const res = await fetch(`/api/git/blame?${params.toString()}`)
      if (!res.ok) return {}
      return (await res.json().catch(() => ({}))) as Record<number, GitBlameLine>
    })().finally(() => {
      if (cacheKey) inFlightRequests.delete(cacheKey)
    })

    if (cacheKey) inFlightRequests.set(cacheKey, fetchPromise)
    return fetchPromise
  }

  async readFileHistory(options: { repo: string; path: string; ref?: string; limit?: number }): Promise<{ commits: GitCommit[] }> {
    const params = new URLSearchParams()
    if (options.repo) params.set('repo', options.repo)
    if (options.path) params.set('path', options.path)
    if (options.ref) params.set('ref', options.ref)
    if (options.limit) params.set('limit', String(options.limit))

    const res = await fetch(`/api/git/file-history?${params.toString()}`)
    if (!res.ok) return { commits: [] }
    return (await res.json().catch(() => ({ commits: [] }))) as { commits: GitCommit[] }
  }

  async checkoutBranch(repo: string, branch: string, options?: GitCheckoutOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkout', repo, branch, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to checkout branch'))
    }
    return { ok: true, message: data.message || `Switched to branch ${branch}` }
  }

  async createBranch(repo: string, branch: string, startPoint?: string, checkout = true): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', repo, branch, startPoint, create: checkout }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to create branch'))
    }
    return { ok: true, message: data.message || `Created branch ${branch}` }
  }

  async deleteBranch(repo: string, branch: string, force = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', repo, branch, force }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to delete branch'))
    }
    return { ok: true, message: data.message || `Deleted branch ${branch}` }
  }

  async renameBranch(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', repo, oldName, newName }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to rename branch'))
    }
    return { ok: true, message: data.message || `Renamed branch to ${newName}` }
  }

  async mergeBranch(repo: string, branch: string): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'merge', repo, branch }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; conflict?: boolean }
    if (!res.ok || data.ok === false) {
      if (data.conflict) {
        return { ok: false, message: data.message || 'Merge conflict detected', conflict: true }
      }
      throw new Error(readApiErrorMessage(data, 'Failed to merge branch'))
    }
    return { ok: true, message: data.message || `Merged branch ${branch}`, conflict: false }
  }

  async rebaseBranch(repo: string, branch: string, options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rebase', repo, branch, abort: options?.abort, continue: options?.continue }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; conflict?: boolean }
    if (!res.ok || data.ok === false) {
      if (data.conflict) {
        return { ok: false, message: data.message || 'Rebase conflict detected', conflict: true }
      }
      throw new Error(readApiErrorMessage(data, 'Failed to rebase branch'))
    }
    return { ok: true, message: data.message || `Rebased onto ${branch}`, conflict: false }
  }

  async cherryPick(repo: string, hash: string, options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cherry-pick', repo, hash, abort: options?.abort, continue: options?.continue }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; conflict?: boolean }
    if (!res.ok || data.ok === false) {
      if (data.conflict) {
        return { ok: false, message: data.message || 'Cherry-pick conflict detected', conflict: true }
      }
      throw new Error(readApiErrorMessage(data, 'Failed to cherry-pick commit'))
    }
    return { ok: true, message: data.message || `Cherry-picked commit ${hash.slice(0, 7)}`, conflict: false }
  }

  async commit(repo: string, message: string, options?: boolean | GitCommitOptions): Promise<{ ok: boolean; message: string; hash?: string }> {
    const opts: GitCommitOptions = typeof options === 'boolean' ? { stageAll: options } : options || {}
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'commit',
        repo,
        message,
        stageAll: opts.stageAll,
        amend: opts.amend,
        noVerify: opts.noVerify,
        pushAfter: opts.pushAfter,
      }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; hash?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to commit'))
    }
    return { ok: true, message: data.message || 'Committed successfully', hash: data.hash }
  }

  async undo(repo: string, soft = true): Promise<{ ok: boolean; message: string; undoneHash?: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'undo',
        repo,
        stageAll: soft,
      }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; undoneHash?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to undo commit'))
    }
    return { ok: true, message: data.message || 'Undid last commit', undoneHash: data.undoneHash }
  }

  async redo(repo: string, soft = true): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'redo',
        repo,
        stageAll: soft,
      }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to redo commit'))
    }
    return { ok: true, message: data.message || 'Redid commit' }
  }

  async getLastCommit(repo: string): Promise<{ summary: string; description: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-last-commit', repo }),
    })
    const data = (await res.json()) as { summary?: string; description?: string }
    return { summary: data.summary || '', description: data.description || '' }
  }

  async createPatch(repo: string, options?: { path?: string; staged?: boolean }): Promise<{ patch: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-patch', repo, path: options?.path, stageAll: options?.staged }),
    })
    const data = (await res.json()) as { patch?: string }
    return { patch: data.patch || '' }
  }

  async ignorePattern(repo: string, pattern: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore', repo, pattern }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to add ignore rule'))
    }
    return { ok: true, message: data.message || 'Added to .gitignore' }
  }

  async createFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-file', repo, relativePath }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to create file'))
    }
    return { ok: true, message: data.message || 'File created' }
  }

  async deleteFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-file', repo, relativePath }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to delete file'))
    }
    return { ok: true, message: data.message || 'File deleted' }
  }

  async stage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stage', repo, files, all }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to stage changes'))
    }
    return { ok: true, message: data.message || 'Changes staged' }
  }

  async unstage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unstage', repo, files, all }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to unstage changes'))
    }
    return { ok: true, message: data.message || 'Changes unstaged' }
  }

  async discard(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discard', repo, files, all }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to discard changes'))
    }
    return { ok: true, message: data.message || 'Changes discarded' }
  }

  async push(repo: string, options?: GitPushOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'push', repo, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to push'))
    }
    return { ok: true, message: data.message || 'Pushed successfully' }
  }

  async pull(repo: string, options?: GitPullOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pull', repo, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to pull'))
    }
    return { ok: true, message: data.message || 'Pulled successfully' }
  }

  async fetch(repo: string, options?: GitFetchOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch', repo, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to fetch'))
    }
    return { ok: true, message: data.message || 'Fetch completed' }
  }

  async getRemotes(repo: string): Promise<GitRemoteSource[]> {
    const res = await fetch(`/api/git/remote?${new URLSearchParams({ repo })}`)
    const data = (await res.json()) as { ok?: boolean; remotes?: GitRemoteSource[]; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to get remotes'))
    }
    return data.remotes || []
  }

  async getRemoteUrl(repo: string, remote: string): Promise<string> {
    const res = await fetch(`/api/git/remote?${new URLSearchParams({ repo, remote })}`)
    const data = (await res.json()) as { ok?: boolean; url?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to get remote URL'))
    }
    return data.url || ''
  }

  async setRemoteUrl(repo: string, remote: string, url: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, action: 'setUrl', remote, url }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to update remote URL'))
    }
    return { ok: true, message: data.message || 'Updated remote' }
  }

  async renameRemote(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, action: 'rename', remote: oldName, newName }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to rename remote'))
    }
    return { ok: true, message: data.message || 'Renamed remote' }
  }

  async addRemote(repo: string, name: string, url: string, pushUrl?: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, action: 'add', name, url, pushUrl }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to add remote'))
    }
    return { ok: true, message: data.message || `Added remote ${name}` }
  }

  async removeRemote(repo: string, remote: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, action: 'remove', remote }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to remove remote'))
    }
    return { ok: true, message: data.message || 'Removed remote' }
  }

  async stash(repo: string, options: GitStashOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'stash',
        repo,
        stashAction: options.action,
        message: options.message,
        stashIndex: options.index,
        files: options.paths,
      }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Stash operation failed'))
    }
    return { ok: true, message: data.message || 'Stash operation succeeded' }
  }

  async getProjects(): Promise<GitProjectCatalog> {
    const key = 'projects:catalog'
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as Promise<GitProjectCatalog>
    }

    const fetchPromise = (async () => {
      const res = await fetch('/api/git/projects')
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed to fetch projects (${res.status})`)
      }
      const data = (await res.json()) as { ok?: boolean; projects?: GitProjectView[]; folders?: string[] }
      return {
        projects: data.projects || [],
        folders: data.folders || [],
      }
    })().finally(() => {
      inFlightRequests.delete(key)
    })

    inFlightRequests.set(key, fetchPromise)
    return fetchPromise
  }

  async addProject(payload: AddProjectPayload): Promise<GitProjectView> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: payload.pathOrUrl,
        name: payload.name,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Failed to add project (${res.status})`)
    }
    const data = (await res.json()) as { ok?: boolean; project: GitProjectView }
    return data.project
  }

  async createFolder(name: string): Promise<GitProjectCatalog> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createFolder', folder: name }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; projects?: GitProjectView[]; folders?: string[] }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to create folder'))
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }

  async renameFolder(oldName: string, newName: string): Promise<GitProjectCatalog> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renameFolder', folder: oldName, name: newName }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; projects?: GitProjectView[]; folders?: string[] }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to rename folder'))
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }

  async clearFolder(name: string): Promise<GitProjectCatalog> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearFolder', folder: name }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; projects?: GitProjectView[]; folders?: string[] }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to clear folder'))
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }

  async setProjectLabel(id: string, label: string): Promise<GitProjectCatalog> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setProjectLabel', id, label }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; projects?: GitProjectView[]; folders?: string[] }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to set project label'))
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }

  async deleteFolder(name: string): Promise<GitDeleteFolderResult> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteFolder', folder: name }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      message?: string
      error?: string
      projects?: GitProjectView[]
      folders?: string[]
      removedCount?: number
    }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to delete folder'))
    }
    return {
      catalog: {
        projects: data.projects || [],
        folders: data.folders || [],
      },
      removedCount: data.removedCount || 0,
    }
  }

  async moveProject(id: string, group: string, beforeId?: string): Promise<GitProjectCatalog> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'moveProject', id, group, beforeId }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; projects?: GitProjectView[]; folders?: string[] }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to move project'))
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }

  async removeProject(id: string): Promise<GitProjectCatalog> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'removeProject', id }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; projects?: GitProjectView[]; folders?: string[] }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to remove project'))
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }

  async addRemoteProject(input: AddRemoteProjectOptions): Promise<GitProjectCatalog> {
    const res = await fetch('/api/git/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; projects?: GitProjectView[]; folders?: string[] }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, 'Failed to add remote project'))
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }

  async addWorktree(repo: string, path: string, branch?: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/worktree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, path, branch }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || 'Failed to add worktree')
    }
    return { ok: true, message: data.message || `Added worktree ${path}` }
  }

  async createTag(repo: string, tag: string, options?: { target?: string; message?: string }): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-tag', repo, tag, target: options?.target, message: options?.message }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || 'Failed to create tag')
    }
    return { ok: true, message: data.message || `Created tag ${tag}` }
  }

  async deleteTag(repo: string, tag: string, options?: { remote?: string }): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-tag', repo, tag, remote: options?.remote }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || 'Failed to delete tag')
    }
    return { ok: true, message: data.message || `Deleted tag ${tag}` }
  }

  async restoreFile(repo: string, commitHash: string, filePath: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore-file', repo, hash: commitHash, path: filePath }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || 'Failed to restore file')
    }
    return { ok: true, message: data.message || `Restored file ${filePath}` }
  }

  async reset(repo: string, target: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', repo, target, mode }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || 'Failed to reset')
    }
    return { ok: true, message: data.message || `Reset to ${target} (${mode})` }
  }

  async revert(repo: string, commit: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revert', repo, hash: commit }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || 'Failed to revert commit')
    }
    return { ok: true, message: data.message || `Reverted commit ${commit.slice(0, 7)}` }
  }
}
