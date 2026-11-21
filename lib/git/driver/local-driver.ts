import { readApiErrorMessage } from '@/lib/api-error'
import { GIT_WORKTREE_HASH, type GitCommitChanges, type GitLogView, type GitProjectCatalog, type GitProjectView, type GitRemoteSource } from '@/lib/git/types'

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
} from './types'

const inFlightRequests = new Map<string, Promise<unknown>>()
const commitDiffClientCache = new Map<string, GitCommitChanges>()
const MAX_CLIENT_CACHE = 200

export class LocalGitDriver implements IGitDriver {
  readonly mode = 'local' as const

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

    const res = await fetch(`/api/git/log?${params.toString()}`)
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null)
      throw new Error(readApiErrorMessage(body, `Failed to read git log (${res.status})`))
    }
    return (await res.json()) as GitLogView
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

    const fetchPromise = (async () => {
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
    })().finally(() => {
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

    const contentType = res.headers.get('content-type') || ''
    const isBinary = !contentType.startsWith('text/') && !contentType.includes('json') && !contentType.includes('javascript')
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

  async checkoutBranch(repo: string, branch: string, options?: GitCheckoutOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkout', repo, branch, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '切换分支失败'))
    }
    return { ok: true, message: data.message || `已切换到分支 ${branch}` }
  }

  async createBranch(repo: string, branch: string, startPoint?: string, checkout = true): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', repo, branch, startPoint, create: checkout }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '创建分支失败'))
    }
    return { ok: true, message: data.message || `已创建分支 ${branch}` }
  }

  async deleteBranch(repo: string, branch: string, force = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', repo, branch, force }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '删除分支失败'))
    }
    return { ok: true, message: data.message || `已删除分支 ${branch}` }
  }

  async renameBranch(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', repo, oldName, newName }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '重命名分支失败'))
    }
    return { ok: true, message: data.message || `已重命名分支为 ${newName}` }
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
        return { ok: false, message: data.message || '合并存在冲突', conflict: true }
      }
      throw new Error(readApiErrorMessage(data, '合并分支失败'))
    }
    return { ok: true, message: data.message || `已合并分支 ${branch}`, conflict: false }
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
        return { ok: false, message: data.message || '变基存在冲突', conflict: true }
      }
      throw new Error(readApiErrorMessage(data, '变基分支失败'))
    }
    return { ok: true, message: data.message || `已将当前分支变基到 ${branch}`, conflict: false }
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
        return { ok: false, message: data.message || '遴选存在冲突', conflict: true }
      }
      throw new Error(readApiErrorMessage(data, '遴选提交失败'))
    }
    return { ok: true, message: data.message || `已成功遴选提交 ${hash.slice(0, 7)}`, conflict: false }
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
      throw new Error(readApiErrorMessage(data, '提交失败'))
    }
    return { ok: true, message: data.message || '提交成功', hash: data.hash }
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
      throw new Error(readApiErrorMessage(data, '撤销提交失败'))
    }
    return { ok: true, message: data.message || '已撤销上一次提交', undoneHash: data.undoneHash }
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
      throw new Error(readApiErrorMessage(data, '重做提交失败'))
    }
    return { ok: true, message: data.message || '已重做提交' }
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
      throw new Error(readApiErrorMessage(data, '忽略操作失败'))
    }
    return { ok: true, message: data.message || '已添加到 .gitignore' }
  }

  async createFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-file', repo, relativePath }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '创建文件失败'))
    }
    return { ok: true, message: data.message || '已创建文件' }
  }

  async deleteFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-file', repo, relativePath }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '删除文件失败'))
    }
    return { ok: true, message: data.message || '已删除文件' }
  }

  async stage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stage', repo, files, all }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '暂存文件失败'))
    }
    return { ok: true, message: data.message || '已暂存更改' }
  }

  async unstage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unstage', repo, files, all }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '取消暂存失败'))
    }
    return { ok: true, message: data.message || '已取消暂存' }
  }

  async discard(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discard', repo, files, all }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '放弃更改失败'))
    }
    return { ok: true, message: data.message || '已放弃更改' }
  }

  async push(repo: string, options?: GitPushOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'push', repo, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '推送失败'))
    }
    return { ok: true, message: data.message || '推送成功' }
  }

  async pull(repo: string, options?: GitPullOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pull', repo, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '拉取失败'))
    }
    return { ok: true, message: data.message || '拉取成功' }
  }

  async fetch(repo: string, options?: GitFetchOptions): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch', repo, ...options }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '抓取失败'))
    }
    return { ok: true, message: data.message || '抓取完成' }
  }

  async getRemotes(repo: string): Promise<GitRemoteSource[]> {
    const res = await fetch(`/api/git/remote?${new URLSearchParams({ repo })}`)
    const data = (await res.json()) as { ok?: boolean; remotes?: GitRemoteSource[]; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '获取远程源列表失败'))
    }
    return data.remotes || []
  }

  async getRemoteUrl(repo: string, remote: string): Promise<string> {
    const res = await fetch(`/api/git/remote?${new URLSearchParams({ repo, remote })}`)
    const data = (await res.json()) as { ok?: boolean; url?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '获取远程源 URL 失败'))
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
      throw new Error(readApiErrorMessage(data, '更新远程源 URL 失败'))
    }
    return { ok: true, message: data.message || '更新成功' }
  }

  async renameRemote(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, action: 'rename', remote: oldName, newName }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '重命名远程源失败'))
    }
    return { ok: true, message: data.message || '重命名成功' }
  }

  async removeRemote(repo: string, remote: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/git/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, action: 'remove', remote }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
    if (!res.ok || data.ok === false) {
      throw new Error(readApiErrorMessage(data, '删除远程源失败'))
    }
    return { ok: true, message: data.message || '删除成功' }
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
      throw new Error(readApiErrorMessage(data, '暂存操作失败'))
    }
    return { ok: true, message: data.message || '暂存操作成功' }
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
      throw new Error(data.message || '创建 Worktree 失败')
    }
    return { ok: true, message: data.message || `已添加工作树 ${path}` }
  }
}
