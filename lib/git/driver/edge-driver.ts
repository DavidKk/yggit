import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import {
  clearEdgeFolder,
  createEdgeFolder,
  deleteEdgeFolder,
  findDirectoryHandleId,
  getDirectoryHandle,
  getEdgeCatalog,
  getEdgeFolders,
  getEdgeRemoteProjects,
  importEdgeRemoteProjects,
  moveEdgeProject,
  removeEdgeProject,
  renameEdgeFolder,
  saveDirectoryHandle,
  saveEdgeRemoteProject,
  setEdgeProjectLabel,
} from '@/lib/git/indexeddb-handles'
import { remoteIdentity, uniqueLocalProject } from '@/lib/git/project-access'
import { listRemoteGroup } from '@/lib/git/remote-groups'
import { parseRemoteUrl } from '@/lib/git/temporary-store'
import type { GitCommit, GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectHost, GitProjectView, GitRemoteSource } from '@/lib/git/types'
import { runWithForegroundPriority } from '@/lib/workdesk/scheduler'
import { parseGitHubRepo, readRemoteBlobData, readRemoteCommitChanges, readRemoteGitLog } from '@/services/git/remote-provider'

import { buildEdgeRemergeDiff, detectEdgeMergeConflict } from './edge-conflicts'
import { readClientLogFallback } from './edge-fallback-log'
import {
  addEdgeRemote,
  checkoutEdgeBranch,
  createEdgeBranch,
  createEdgeTag,
  deleteEdgeBranch,
  deleteEdgeTag,
  getEdgeRemoteUrl,
  listEdgeRemotes,
  removeEdgeRemote,
  renameEdgeRemote,
  setEdgeRemoteUrl,
} from './edge-git-refs'
import { commitEdgeChanges, fetchEdgeRepo, pullEdgeRepo, readEdgeLastCommit, stageEdgeFiles, unstageEdgeFiles } from './edge-git-write'
import { EdgeRepositoryReader } from './edge-repository-reader'
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

export class EdgeGitDriver implements IGitDriver {
  readonly mode = 'edge' as const
  private readonly repositories = new Map<string, Promise<EdgeRepositoryReader>>()

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' || typeof global !== 'undefined'
  }

  clearCache(repo?: string): void {
    if (repo) {
      this.repoPathCache.delete(repo)
    } else {
      for (const pending of this.repositories.values()) {
        void pending.then((r) => r.dispose()).catch(() => {})
      }
      this.repositories.clear()
      this.repoPathCache.clear()
    }
  }

  private readonly repoPathCache = new Map<string, string>()

  async resolveRepo(repo: string): Promise<string> {
    if (!repo || !repo.trim()) return repo
    const cached = this.repoPathCache.get(repo)
    if (cached) return cached

    // 1. Keep explicit edge_ handle IDs directly
    if (repo.startsWith('edge_')) {
      return repo
    }

    // 2. Look up in Edge IndexedDB catalog first (including matching a mounted edge_ folder for a GitHub slug/URL)
    const edgeProjects = typeof getEdgeCatalog === 'function' ? (await getEdgeCatalog().catch(() => ({ projects: [] }))).projects || [] : []
    const edgeProj = edgeProjects.find((p) => p.id === repo || p.name === repo || p.localPath === repo)
    if (edgeProj?.localPath?.startsWith('edge_')) {
      this.repoPathCache.set(repo, edgeProj.localPath)
      return edgeProj.localPath
    }

    const gh = parseGitHubRepo(repo)
    const lookupUrl = edgeProj?.httpsUrl || (gh ? `https://github.com/${gh.owner}/${gh.repo}.git` : repo)
    const localMatch = uniqueLocalProject(edgeProjects, lookupUrl)?.localPath
    if (localMatch && localMatch.startsWith('edge_')) {
      this.repoPathCache.set(repo, localMatch)
      return localMatch
    }

    if (gh) {
      return repo
    }

    if (repo.startsWith('/')) {
      const folderName = repo.split('/').filter(Boolean).pop()
      if (folderName) {
        const nameMatches = edgeProjects.filter((p) => p.localPath?.startsWith('edge_') && p.name === folderName)
        if (nameMatches.length === 1 && nameMatches[0].localPath) {
          this.repoPathCache.set(repo, nameMatches[0].localPath)
          return nameMatches[0].localPath
        }
      }
    }

    if (edgeProj?.httpsUrl && parseGitHubRepo(edgeProj.httpsUrl)) {
      this.repoPathCache.set(repo, edgeProj.httpsUrl)
      return edgeProj.httpsUrl
    }

    return repo
  }

  private repository(repo: string): Promise<EdgeRepositoryReader> {
    if (!repo || !repo.trim()) {
      return Promise.reject(new Error('Repository path is required'))
    }
    const hit = this.repositories.get(repo)
    if (hit) return hit
    const pending = getDirectoryHandle(repo)
      .then((handle) => {
        if (!handle) throw new Error(`RESOURCE_UNRESOLVED: Directory handle for "${repo}" not found.`)
        return new EdgeRepositoryReader(handle)
      })
      .catch((error) => {
        if (this.repositories.get(repo) === pending) this.repositories.delete(repo)
        throw error
      })
    this.repositories.set(repo, pending)
    if (this.repositories.size > 2) {
      const oldestKey = this.repositories.keys().next().value!
      const oldest = this.repositories.get(oldestKey)
      this.repositories.delete(oldestKey)
      void oldest?.then((r) => r.dispose()).catch(() => {})
    }
    return pending
  }

  async readLog(options: ReadLogOptions): Promise<GitLogView> {
    if (!options.repo || !options.repo.trim()) {
      throw new Error('Repository path is required')
    }

    const resolvedRepo = await this.resolveRepo(options.repo)

    // 1. Check if it's a public GitHub remote repo
    const gh = parseGitHubRepo(resolvedRepo)
    if (gh && !resolvedRepo.startsWith('edge_')) {
      options.onProgress?.('Fetching remote Git repository history...')
      return await readRemoteGitLog(resolvedRepo, options.branch || options.ref, options.skip)
    }

    // 2. Pure-browser directory handle reader
    const reader = await this.repository(resolvedRepo)
    return await readClientLogFallback(reader, options, resolvedRepo)
  }

  async searchLog(_options: SearchLogOptions): Promise<{ commits: GitCommit[] }> {
    return { commits: [] }
  }

  async readCommitDiff(options: ReadCommitDiffOptions): Promise<GitCommitChanges> {
    return runWithForegroundPriority(async () => {
      const { hash } = options
      const resolvedRepo = await this.resolveRepo(options.repo)
      const gh = parseGitHubRepo(resolvedRepo)
      if (gh && !resolvedRepo.startsWith('edge_')) {
        return await readRemoteCommitChanges(resolvedRepo, hash, options)
      }

      const reader = await this.repository(resolvedRepo)
      return await reader.readChanges(options)
    })
  }

  async readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }> {
    const { hash, path } = options
    const resolvedRepo = await this.resolveRepo(options.repo)
    const gh = parseGitHubRepo(resolvedRepo)
    if (gh && !resolvedRepo.startsWith('edge_')) {
      const blob = await readRemoteBlobData(resolvedRepo, hash, path)
      const binary = blob.bytes.slice(0, 8000).includes(0) || /^(image|audio|video)\//.test(blob.contentType)
      return { content: binary ? '' : new TextDecoder().decode(blob.bytes), binary }
    }

    return (await this.repository(resolvedRepo)).readBlob(hash, path)
  }

  async detectConflictsBatch(repo: string, commits: Array<{ hash: string; parents: string[] }>): Promise<Record<string, MergeConflictRecord>> {
    const resolvedRepo = await this.resolveRepo(repo)
    if (parseGitHubRepo(resolvedRepo) && !resolvedRepo.startsWith('edge_')) {
      return {}
    }
    try {
      const reader = await this.repository(resolvedRepo)
      const entries = await Promise.all(
        commits.filter((c) => c.parents && c.parents.length >= 2).map(async (c) => [c.hash, await detectEdgeMergeConflict(reader, c.hash, c.parents)] as const)
      )
      return Object.fromEntries(entries)
    } catch {
      return {}
    }
  }

  async readRemergeDiff(repo: string, hash: string): Promise<{ diff: string; files: string[]; record: MergeConflictRecord | null }> {
    const resolvedRepo = await this.resolveRepo(repo)
    if (parseGitHubRepo(resolvedRepo) && !resolvedRepo.startsWith('edge_')) {
      return { diff: '', files: [], record: null }
    }
    try {
      const reader = await this.repository(resolvedRepo)
      return await buildEdgeRemergeDiff(reader, hash)
    } catch {
      return { diff: '', files: [], record: null }
    }
  }

  async readBlame(_options: { repo: string; path: string; hash?: string }): Promise<Record<number, GitBlameLine>> {
    return {}
  }

  async readFileHistory(options: { repo: string; path: string; ref?: string; limit?: number }): Promise<{ commits: GitCommit[] }> {
    const resolvedRepo = await this.resolveRepo(options.repo)
    if (parseGitHubRepo(resolvedRepo) && !resolvedRepo.startsWith('edge_')) {
      return { commits: [] }
    }
    try {
      const { default: git } = await import('isomorphic-git')
      const reader = await this.repository(resolvedRepo)
      const logs = await git.log({
        fs: reader.fs,
        dir: '/',
        ref: options.ref || 'HEAD',
        filepath: options.path,
        depth: options.limit || 40,
        cache: reader.cache,
      })
      return {
        commits: logs.map((entry) => ({
          hash: entry.oid,
          short: entry.oid.slice(0, 7),
          parents: entry.commit.parent || [],
          author: entry.commit.author?.name || 'Unknown',
          date: new Date((entry.commit.author?.timestamp || 0) * 1000).toISOString(),
          refs: [],
          subject: (entry.commit.message || '').split('\n')[0] || '',
        })),
      }
    } catch {
      return { commits: [] }
    }
  }

  async checkoutBranch(repo: string, branch: string, _options?: GitCheckoutOptions): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return checkoutEdgeBranch(reader, branch)
  }

  async createBranch(repo: string, branch: string, startPoint?: string, checkout = true): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return createEdgeBranch(reader, branch, startPoint, checkout)
  }

  async deleteBranch(repo: string, branch: string, _force = false): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return deleteEdgeBranch(reader, branch)
  }

  private unsupportedInEdge(action: string): never {
    throw new Error(`${action} is not supported in pure-browser Edge mode; switch to Local mode`)
  }

  async renameBranch(_repo: string, _oldName: string, _newName: string): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Renaming branch')
  }

  async mergeBranch(_repo: string, _branch: string): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    this.unsupportedInEdge('Merging branch')
  }

  async rebaseBranch(_repo: string, _branch: string, _options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    this.unsupportedInEdge('Rebasing branch')
  }

  async cherryPick(_repo: string, _hash: string, _options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    this.unsupportedInEdge('Cherry-pick')
  }

  async commit(repo: string, message: string, options?: boolean | GitCommitOptions): Promise<{ ok: boolean; message: string; hash?: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return commitEdgeChanges(reader, message, options)
  }

  async undo(_repo: string, _soft = true): Promise<{ ok: boolean; message: string; undoneHash?: string }> {
    this.unsupportedInEdge('Undo commit')
  }

  async redo(_repo: string, _soft = true): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Redo commit')
  }

  async getLastCommit(repo: string): Promise<{ summary: string; description: string }> {
    try {
      const reader = await this.repository(await this.resolveRepo(repo))
      return readEdgeLastCommit(reader)
    } catch {
      return { summary: '', description: '' }
    }
  }

  async createPatch(_repo: string, _options?: { path?: string; staged?: boolean }): Promise<{ patch: string }> {
    return { patch: '' }
  }

  async ignorePattern(_repo: string, _pattern: string): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Adding ignore pattern')
  }

  async createFile(_repo: string, _relativePath: string): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Creating file')
  }

  async deleteFile(_repo: string, _relativePath: string): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Deleting file')
  }

  async stage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return stageEdgeFiles(reader, files, all)
  }

  async unstage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return unstageEdgeFiles(reader, files, all)
  }

  async discard(_repo: string, _files?: string[], _all = false): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Discarding changes')
  }

  async push(_repo: string, _options?: GitPushOptions): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Push')
  }

  async pull(repo: string, options?: GitPullOptions): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return pullEdgeRepo(reader, options)
  }

  async fetch(repo: string, options?: GitFetchOptions): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return fetchEdgeRepo(reader, options)
  }

  async stash(_repo: string, _options: GitStashOptions): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Stash')
  }

  async addWorktree(_repo: string, _path: string, _branch?: string): Promise<{ ok: boolean; message: string }> {
    this.unsupportedInEdge('Worktree')
  }

  async createTag(repo: string, tag: string, options?: { target?: string; message?: string }): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return createEdgeTag(reader, tag, options)
  }

  async deleteTag(repo: string, tag: string): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return deleteEdgeTag(reader, tag)
  }

  async getRemotes(repo: string): Promise<GitRemoteSource[]> {
    try {
      const reader = await this.repository(await this.resolveRepo(repo))
      return listEdgeRemotes(reader)
    } catch {
      return []
    }
  }

  async getRemoteUrl(repo: string, remote: string): Promise<string> {
    try {
      const reader = await this.repository(await this.resolveRepo(repo))
      return getEdgeRemoteUrl(reader, remote)
    } catch {
      return ''
    }
  }

  async addRemote(repo: string, name: string, url: string, _pushUrl?: string): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return addEdgeRemote(reader, name, url)
  }

  async setRemoteUrl(repo: string, remote: string, url: string): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return setEdgeRemoteUrl(reader, remote, url)
  }

  async renameRemote(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return renameEdgeRemote(reader, oldName, newName)
  }

  async removeRemote(repo: string, remote: string): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(await this.resolveRepo(repo))
    return removeEdgeRemote(reader, remote)
  }

  async getProjects(): Promise<GitProjectCatalog> {
    return getEdgeCatalog()
  }

  async addProject(payload: AddProjectPayload): Promise<GitProjectView> {
    const id = payload.handle ? (await findDirectoryHandleId(payload.handle)) || `edge_${crypto.randomUUID()}` : payload.pathOrUrl
    const folders = await getEdgeFolders()
    let group = payload.group
    if (folders.length === 0) {
      await createEdgeFolder('未分类')
      group = '未分类'
    } else if (!group || !folders.includes(group)) {
      group = folders[0] || '未分类'
    }

    if (payload.handle) {
      // 1. Verify that .git exists in handle
      try {
        const { createDirectoryHandleFs } = await import('./handle-fs')
        const fs = createDirectoryHandleFs(payload.handle)
        await fs.promises.stat('/.git')
      } catch {
        throw new Error(`Selected folder "${payload.handle.name}" is not a valid Git repository (.git not found)`)
      }

      await saveDirectoryHandle(id, payload.handle, payload.name, group)
      const { saveRepoAlias } = await import('@/lib/git/indexeddb-handles')
      await saveRepoAlias(payload.handle.name, id).catch(() => {})
      await saveRepoAlias(id, payload.handle.name).catch(() => {})

      return {
        id,
        name: payload.name || payload.handle.name || id,
        group,
        host: 'local',
        localPath: id,
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: true,
      }
    }

    return {
      id,
      name: payload.name || id,
      group,
      host: id.includes('github') ? 'github' : 'gitlab',
      localPath: '',
      httpsUrl: id,
      local: false,
      remote: true,
      authorized: true,
    }
  }

  async createFolder(name: string): Promise<GitProjectCatalog> {
    await createEdgeFolder(name)
    return getEdgeCatalog()
  }

  async renameFolder(oldName: string, newName: string): Promise<GitProjectCatalog> {
    await renameEdgeFolder(oldName, newName)
    return getEdgeCatalog()
  }

  async clearFolder(name: string): Promise<GitProjectCatalog> {
    await clearEdgeFolder(name)
    return getEdgeCatalog()
  }

  async setProjectLabel(id: string, label: string): Promise<GitProjectCatalog> {
    await setEdgeProjectLabel(id, label)
    return getEdgeCatalog()
  }

  async deleteFolder(name: string): Promise<GitDeleteFolderResult> {
    const result = await deleteEdgeFolder(name)
    const catalog = await getEdgeCatalog()
    return {
      catalog,
      removedCount: result.removedCount,
    }
  }

  async moveProject(id: string, group: string, beforeId?: string): Promise<GitProjectCatalog> {
    await moveEdgeProject(id, group, beforeId)
    return getEdgeCatalog()
  }

  async removeProject(id: string): Promise<GitProjectCatalog> {
    await removeEdgeProject(id)
    return getEdgeCatalog()
  }

  async addRemoteProject(input: AddRemoteProjectOptions): Promise<GitProjectCatalog> {
    if (input.importGroup) {
      if (!input.provider || !input.group?.trim()) throw new Error('REMOTE_GROUP_INVALID_INPUT')
      const remotes = await listRemoteGroup({ ...input, provider: input.provider })
      if (!remotes.length) throw new Error('REMOTE_GROUP_EMPTY')
      const group = input.group.trim().replace(/\s+/g, ' ')
      const existing = await getEdgeRemoteProjects()
      if (/[/\\]/.test(group)) throw new Error('REMOTE_GROUP_INVALID_FOLDER')
      const catalog = await getEdgeCatalog()
      const keys = new Set(remotes.map((remote) => remoteIdentity(remote.httpsUrl)))
      const localIds = catalog.projects.filter((project) => project.local && keys.has(remoteIdentity(project.httpsUrl))).map((project) => project.localPath)
      const records = remotes.map((remote) => {
        const parsed = parseRemoteUrl(remote.httpsUrl)
        const id = parsed?.fingerprint || remote.remoteKey
        const previous = existing.find((item) => item.id === id)
        return {
          ...previous,
          id,
          name: previous?.name || remote.name,
          url: remote.httpsUrl,
          host: input.provider!,
          group,
          token: input.token || previous?.token,
          order: previous?.order ?? Date.now(),
          updatedAt: Date.now(),
        }
      })
      await importEdgeRemoteProjects(records, group, localIds)
      return getEdgeCatalog()
    }
    const parsed = parseRemoteUrl(input.url)
    const name =
      input.name ||
      parsed?.name ||
      input.url
        .split('/')
        .pop()
        ?.replace(/\.git$/, '') ||
      'remote-repo'
    const id = parsed?.fingerprint || input.url
    const host: GitProjectHost = parsed?.provider === 'gitlab' ? 'gitlab' : 'github'

    const folders = await getEdgeFolders()
    let group = input.group
    if (folders.length === 0) {
      await createEdgeFolder('未分类')
      group = '未分类'
    } else if (!group || !folders.includes(group)) {
      group = folders[0] || '未分类'
    }

    await saveEdgeRemoteProject({
      id,
      name,
      url: parsed?.remoteUrl || input.url,
      host,
      group,
      token: input.token,
      order: Date.now(),
      updatedAt: Date.now(),
    })

    return getEdgeCatalog()
  }
}
