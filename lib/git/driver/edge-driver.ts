import git from 'isomorphic-git'

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
import { isPrivateRemote, remoteIdentity, uniqueLocalProject } from '@/lib/git/project-access'
import { listRemoteGroup } from '@/lib/git/remote-groups'
import { parseRemoteUrl } from '@/lib/git/temporary-store'
import type { GitCommit, GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectHost, GitProjectView, GitRemoteSource } from '@/lib/git/types'
import { parseGitHubRepo, readRemoteBlobData, readRemoteCommitChanges, readRemoteGitLog } from '@/services/git/remote-provider'

import { readClientLogFallback } from './edge-fallback-log'
import { EdgeRepositoryReader } from './edge-repository-reader'
import { LocalGitDriver } from './local-driver'
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

export class EdgeGitDriver implements IGitDriver {
  readonly mode = 'edge' as const
  private readonly repositories = new Map<string, Promise<EdgeRepositoryReader>>()
  private readonly companion = new LocalGitDriver()

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' || typeof global !== 'undefined'
  }

  clearCache(repo?: string): void {
    this.companion.clearCache?.(repo)
    if (repo) {
      this.repositories.delete(repo)
      this.repoPathCache.delete(repo)
    } else {
      this.repositories.clear()
      this.repoPathCache.clear()
    }
  }

  private readonly repoPathCache = new Map<string, string>()

  async resolveRepo(repo: string): Promise<string> {
    if (!repo || !repo.trim()) return repo
    const cached = this.repoPathCache.get(repo)
    if (cached) return cached

    // 1. If it's already an absolute path (starts with / or has drive letter on windows), keep it
    if (repo.startsWith('/') || repo.includes(':\\')) {
      return repo
    }

    // 2. Look up in Edge catalog
    const edgeProjects = typeof getEdgeCatalog === 'function' ? (await getEdgeCatalog().catch(() => ({ projects: [] }))).projects || [] : []
    const edgeProj = edgeProjects.find((p) => p.id === repo || p.name === repo || p.localPath === repo)

    // 3. Try uniqueLocalProject by remote URL
    if (edgeProj?.httpsUrl) {
      const localMatch = uniqueLocalProject(edgeProjects, edgeProj.httpsUrl)?.localPath
      if (localMatch && !localMatch.startsWith('edge_')) {
        this.repoPathCache.set(repo, localMatch)
        return localMatch
      }
    }

    // 4. Try matching with companion catalog
    try {
      const companionCatalog = await this.companion.getProjects()
      const companionProjects = companionCatalog.projects || []

      // Match by ID
      const byId = companionProjects.find((p) => p.id === repo)
      if (byId?.localPath) {
        this.repoPathCache.set(repo, byId.localPath)
        return byId.localPath
      }

      // Match by remote / httpsUrl
      const targetIdentity = remoteIdentity(edgeProj?.httpsUrl || edgeProj?.remotes?.[0]?.url || repo)
      if (targetIdentity) {
        const byRemote = companionProjects.find((p) => remoteIdentity(p.httpsUrl || p.remotes?.[0]?.url || '') === targetIdentity)
        if (byRemote?.localPath) {
          this.repoPathCache.set(repo, byRemote.localPath)
          return byRemote.localPath
        }
      }

      // Match by name
      const targetName = (edgeProj?.name || repo).toLowerCase()
      const byName = companionProjects.find((p) => p.name.toLowerCase() === targetName)
      if (byName?.localPath) {
        this.repoPathCache.set(repo, byName.localPath)
        return byName.localPath
      }
    } catch {
      // Companion offline or not available
    }

    // If edgeProj has a real localPath (not edge_...)
    if (edgeProj?.localPath && !edgeProj.localPath.startsWith('edge_')) {
      this.repoPathCache.set(repo, edgeProj.localPath)
      return edgeProj.localPath
    }

    return repo
  }

  private repository(repo: string): Promise<EdgeRepositoryReader> {
    if (!repo || !repo.trim()) {
      return Promise.reject(new Error('未指定项目仓库路径'))
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
    if (this.repositories.size > 2) this.repositories.delete(this.repositories.keys().next().value!)
    return pending
  }

  async readLog(options: ReadLogOptions): Promise<GitLogView> {
    if (!options.repo || !options.repo.trim()) {
      throw new Error('未指定项目仓库路径')
    }

    const resolvedRepo = await this.resolveRepo(options.repo)

    // 1. Try local companion backend first (provides 100% parity with Local mode on localhost / dev companion)
    if (!resolvedRepo.startsWith('edge_')) {
      try {
        const companionLog = await this.companion.readLog({ ...options, repo: resolvedRepo })
        if (companionLog && companionLog.commits) {
          return companionLog
        }
      } catch {
        // Local companion not available, fall through to client-side edge reader
      }
    }

    // 2. Check if it's a GitHub remote repo
    const gh = parseGitHubRepo(resolvedRepo)
    if (gh && !resolvedRepo.startsWith('edge_')) {
      options.onProgress?.('Fetching remote Git repository history...')
      return await readRemoteGitLog(resolvedRepo, options.branch || options.ref, options.skip)
    }

    // 3. Client-side browser directory handle fallback
    const reader = await this.repository(options.repo)
    return await readClientLogFallback(reader, options, resolvedRepo)
  }

  async readCommitDiff(options: ReadCommitDiffOptions): Promise<GitCommitChanges> {
    const { hash } = options
    const resolvedRepo = await this.resolveRepo(options.repo)
    const gh = parseGitHubRepo(resolvedRepo)
    if (gh) {
      return await readRemoteCommitChanges(resolvedRepo, hash, options)
    }

    if (!resolvedRepo.startsWith('edge_')) {
      try {
        return await this.companion.readCommitDiff({ ...options, repo: resolvedRepo })
      } catch {
        // Fallback to client reader
      }
    }

    const reader = await this.repository(options.repo)
    return await reader.readChanges(options)
  }

  async readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }> {
    const { hash, path } = options
    const resolvedRepo = await this.resolveRepo(options.repo)
    const gh = parseGitHubRepo(resolvedRepo)
    if (gh) {
      const blob = await readRemoteBlobData(resolvedRepo, hash, path)
      const binary = blob.bytes.slice(0, 8000).includes(0) || /^(image|audio|video)\//.test(blob.contentType)
      return { content: binary ? '' : new TextDecoder().decode(blob.bytes), binary }
    }

    if (!resolvedRepo.startsWith('edge_')) {
      try {
        return await this.companion.readBlob({ ...options, repo: resolvedRepo })
      } catch {
        // Fallback to client reader
      }
    }

    return (await this.repository(options.repo)).readBlob(hash, path)
  }

  async readBlame(options: { repo: string; path: string; hash?: string }): Promise<Record<number, GitBlameLine>> {
    const target = await this.resolveRepo(options.repo)
    try {
      return await this.companion.readBlame({ ...options, repo: target })
    } catch {
      return {}
    }
  }

  async readFileHistory(options: { repo: string; path: string; ref?: string; limit?: number }): Promise<{ commits: GitCommit[] }> {
    const target = await this.resolveRepo(options.repo)
    try {
      return await this.companion.readFileHistory({ ...options, repo: target })
    } catch {
      return { commits: [] }
    }
  }

  async checkoutBranch(repo: string, branch: string, options?: GitCheckoutOptions): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.checkoutBranch(target, branch, options)
    } catch (err) {
      throw new Error(`切换分支失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async createBranch(repo: string, branch: string, startPoint?: string, checkout = true): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.createBranch(target, branch, startPoint, checkout)
    } catch (err) {
      throw new Error(`创建分支失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async deleteBranch(repo: string, branch: string, force = false): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.deleteBranch(target, branch, force)
      } catch {
        // Fallback to isomorphic-git
      }
    }
    const reader = await this.repository(repo)
    const { fs } = reader
    try {
      await git.deleteBranch({ fs, dir: '/', ref: branch })
      return { ok: true, message: `已删除分支 ${branch}` }
    } catch (error) {
      throw new Error(`删除分支失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async renameBranch(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.renameBranch(target, oldName, newName)
    } catch (err) {
      throw new Error(`重命名分支失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async mergeBranch(repo: string, branch: string): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.mergeBranch(target, branch)
    } catch (err) {
      throw new Error(`合并分支失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async rebaseBranch(repo: string, branch: string, options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.rebaseBranch(target, branch, options)
    } catch (err) {
      throw new Error(`变基分支失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async cherryPick(repo: string, hash: string, options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.cherryPick(target, hash, options)
    } catch (err) {
      throw new Error(`遴选提交失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async commit(repo: string, message: string, options?: boolean | GitCommitOptions): Promise<{ ok: boolean; message: string; hash?: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.commit(target, message, options)
    } catch (err) {
      throw new Error(`提交失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async undo(repo: string, soft = true): Promise<{ ok: boolean; message: string; undoneHash?: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.undo(target, soft)
    } catch (err) {
      throw new Error(`撤销提交失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async redo(repo: string, soft = true): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.redo(target, soft)
    } catch (err) {
      throw new Error(`重做提交失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async getLastCommit(repo: string): Promise<{ summary: string; description: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.getLastCommit(target)
    } catch {
      return { summary: '', description: '' }
    }
  }

  async createPatch(repo: string, options?: { path?: string; staged?: boolean }): Promise<{ patch: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.createPatch(target, options)
    } catch {
      return { patch: '' }
    }
  }

  async ignorePattern(repo: string, pattern: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.ignorePattern(target, pattern)
    } catch (err) {
      throw new Error(`添加忽略失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async createFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.createFile(target, relativePath)
    } catch (err) {
      throw new Error(`创建文件失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async deleteFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.deleteFile(target, relativePath)
    } catch (err) {
      throw new Error(`删除文件失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async stage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.stage(target, files, all)
    } catch (err) {
      throw new Error(`暂存失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async unstage(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.unstage(target, files, all)
    } catch (err) {
      throw new Error(`取消暂存失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async discard(repo: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.discard(target, files, all)
    } catch (err) {
      throw new Error(`放弃修改失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async push(repo: string, options?: GitPushOptions): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.push(target, options)
    } catch (err) {
      throw new Error(`推送失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async pull(repo: string, options?: GitPullOptions): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.pull(target, options)
      } catch {
        // Fallback to browser isomorphic-git fast-forward pull
      }
    }

    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      const http = (await import('isomorphic-git/http/web')).default
      await git.pull({
        fs,
        http,
        dir: '/',
        remote: options?.remote || 'origin',
        ref: options?.branch,
        singleBranch: true,
        fastForwardOnly: true,
        author: { name: 'Edge User', email: 'edge@yggdrasil.local' },
      })
      return { ok: true, message: '拉取完成' }
    } catch (error) {
      throw new Error(`拉取失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async fetch(repo: string, options?: GitFetchOptions): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.fetch(target, options)
      } catch {
        // Fallback to browser isomorphic-git fetch
      }
    }

    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      const http = (await import('isomorphic-git/http/web')).default
      await git.fetch({
        fs,
        http,
        dir: '/',
        remote: options?.remote || 'origin',
        prune: options?.prune !== false,
        tags: true,
      })
      this.repositories.delete(repo)
      return { ok: true, message: '抓取完成' }
    } catch (error) {
      throw new Error(`抓取失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async stash(repo: string, options: GitStashOptions): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.stash(target, options)
    } catch (err) {
      throw new Error(`暂存操作失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async addWorktree(repo: string, path: string, branch?: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.addWorktree(target, path, branch)
    } catch (err) {
      throw new Error(`添加工作树失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async createTag(repo: string, tag: string, options?: { target?: string; message?: string }): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.createTag(target, tag, options)
    } catch (err) {
      throw new Error(`创建标签失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async deleteTag(repo: string, tag: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    try {
      return await this.companion.deleteTag(target, tag)
    } catch (err) {
      throw new Error(`删除标签失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async getRemotes(repo: string): Promise<GitRemoteSource[]> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.getRemotes(target)
      } catch {
        // Fallback to isomorphic-git
      }
    }
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      const rawRemotes = await git.listRemotes({ fs, dir: '/' })
      return rawRemotes
        .filter((r) => r.url)
        .map((r) => ({
          name: r.remote,
          url: r.url!,
          isPrivate: isPrivateRemote(r.url!),
        }))
    } catch {
      return []
    }
  }

  async getRemoteUrl(repo: string, remote: string): Promise<string> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.getRemoteUrl(target, remote)
      } catch {
        // Fallback
      }
    }
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      const rawRemotes = await git.listRemotes({ fs, dir: '/' })
      const found = rawRemotes.find((r) => r.remote === remote)
      return found?.url || ''
    } catch {
      return ''
    }
  }

  async addRemote(repo: string, name: string, url: string, pushUrl?: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.addRemote(target, name, url, pushUrl)
      } catch {
        // Fallback
      }
    }
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      await git.addRemote({ fs, dir: '/', remote: name, url, force: true })
      return { ok: true, message: `成功添加远程源 ${name}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '添加远程源失败' }
    }
  }

  async setRemoteUrl(repo: string, remote: string, url: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.setRemoteUrl(target, remote, url)
      } catch {
        // Fallback
      }
    }
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      await git.deleteRemote({ fs, dir: '/', remote }).catch(() => {})
      await git.addRemote({ fs, dir: '/', remote, url, force: true })
      return { ok: true, message: `成功更新远程源 ${remote}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '更新远程源失败' }
    }
  }

  async renameRemote(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.renameRemote(target, oldName, newName)
      } catch {
        // Fallback
      }
    }
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      const remotes = await git.listRemotes({ fs, dir: '/' })
      const found = remotes.find((r) => r.remote === oldName)
      if (!found?.url) throw new Error(`未找到远程源 ${oldName}`)
      await git.deleteRemote({ fs, dir: '/', remote: oldName })
      await git.addRemote({ fs, dir: '/', remote: newName, url: found.url, force: true })
      return { ok: true, message: `远程源已重命名为 ${newName}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '重命名远程源失败' }
    }
  }

  async removeRemote(repo: string, remote: string): Promise<{ ok: boolean; message: string }> {
    const target = await this.resolveRepo(repo)
    if (!target.startsWith('edge_')) {
      try {
        return await this.companion.removeRemote(target, remote)
      } catch {
        // Fallback
      }
    }
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      await git.deleteRemote({ fs, dir: '/', remote })
      return { ok: true, message: `成功删除远程源 ${remote}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '删除远程源失败' }
    }
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
      await saveDirectoryHandle(id, payload.handle, payload.name, group)
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
