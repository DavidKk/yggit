import git from 'isomorphic-git'

import { GIT_LOG_PAGE_SIZE } from '@/lib/git/identity'
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
import type { GitCommit, GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectHost, GitProjectView, GitRemoteBranch, GitWorktree } from '@/lib/git/types'
import { parseGitHubRepo, readRemoteBlobData, readRemoteCommitChanges, readRemoteGitLog } from '@/services/git/remote-provider'

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
} from './types'

export class EdgeGitDriver implements IGitDriver {
  readonly mode = 'edge' as const
  private readonly repositories = new Map<string, Promise<EdgeRepositoryReader>>()

  async checkoutBranch(_repo: string, _branch: string, _options?: GitCheckoutOptions): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持直接切换分支，请在本地模式使用')
  }

  async createBranch(_repo: string, _branch: string, _startPoint?: string, _checkout?: boolean): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持创建分支，请在本地模式使用')
  }

  async deleteBranch(_repo: string, _branch: string, _force?: boolean): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持删除分支，请在本地模式使用')
  }

  async renameBranch(_repo: string, _oldName: string, _newName: string): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持重命名分支，请在本地模式使用')
  }

  async mergeBranch(_repo: string, _branch: string): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    throw new Error('浏览器 Edge 模式暂不支持合并分支，请在本地模式使用')
  }

  async rebaseBranch(_repo: string, _branch: string, _options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    throw new Error('浏览器 Edge 模式暂不支持变基分支，请在本地模式使用')
  }

  async cherryPick(_repo: string, _hash: string, _options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    throw new Error('浏览器 Edge 模式暂不支持遴选提交，请在本地模式使用')
  }

  async commit(_repo: string, _message: string, _options?: boolean | GitCommitOptions): Promise<{ ok: boolean; message: string; hash?: string }> {
    throw new Error('浏览器 Edge 模式暂不支持提交，请在本地模式使用')
  }

  async undo(_repo: string, _soft?: boolean): Promise<{ ok: boolean; message: string; undoneHash?: string }> {
    throw new Error('浏览器 Edge 模式暂不支持撤销提交，请在本地模式使用')
  }

  async redo(_repo: string, _soft?: boolean): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持重做提交，请在本地模式使用')
  }

  async getLastCommit(_repo: string): Promise<{ summary: string; description: string }> {
    return { summary: '', description: '' }
  }

  async createPatch(_repo: string, _options?: { path?: string; staged?: boolean }): Promise<{ patch: string }> {
    return { patch: '' }
  }

  async ignorePattern(_repo: string, _pattern: string): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持添加忽略，请在本地模式使用')
  }

  async createFile(_repo: string, _relativePath: string): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持新建文件，请在本地模式使用')
  }

  async deleteFile(_repo: string, _relativePath: string): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持删除文件，请在本地模式使用')
  }

  async stage(_repo: string, _files?: string[], _all?: boolean): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持暂存，请在本地模式使用')
  }

  async unstage(_repo: string, _files?: string[], _all?: boolean): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持取消暂存，请在本地模式使用')
  }

  async discard(_repo: string, _files?: string[], _all?: boolean): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持撤销更改，请在本地模式使用')
  }

  async push(_repo: string, _options?: GitPushOptions): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持推送，请在本地模式使用')
  }

  async pull(_repo: string, _options?: GitPullOptions): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持拉取，请在本地模式使用')
  }

  async fetch(_repo: string, _options?: GitFetchOptions): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持抓取，请在本地模式使用')
  }

  async stash(_repo: string, _options: GitStashOptions): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持暂存栈，请在本地模式使用')
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

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' || typeof global !== 'undefined'
  }

  async readLog(options: ReadLogOptions): Promise<GitLogView> {
    if (!options.repo || !options.repo.trim()) {
      throw new Error('未指定项目仓库路径')
    }
    const { branch, ref } = options
    const repo = parseGitHubRepo(options.repo) ? uniqueLocalProject((await getEdgeCatalog()).projects, options.repo)?.localPath || options.repo : options.repo

    // Check if it's a GitHub remote repo
    const gh = parseGitHubRepo(repo)
    if (gh) {
      options.onProgress?.('正在拉取远端 Git 仓库历史...')
      return await readRemoteGitLog(repo, branch || ref, options.skip)
    }

    options.onProgress?.('正在访问文件系统句柄...')
    const reader = await this.repository(repo)
    const { handle, fs, cache } = reader

    try {
      // Check and request permission if needed
      let perm = typeof handle.queryPermission === 'function' ? await handle.queryPermission({ mode: 'read' }) : 'granted'
      if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
        try {
          perm = await handle.requestPermission({ mode: 'read' })
        } catch {
          // ignore user gesture rejection
        }
      }
      if (perm !== 'granted') {
        throw new Error(`PERMISSION_REQUIRED: Read permission needed for directory "${handle.name}".`)
      }

      // Verify that this is a git directory
      try {
        await fs.promises.stat('/.git')
      } catch {
        throw new Error(`NOT_A_GIT_REPO: Directory "${handle.name}" does not contain a .git folder.`)
      }

      options.onProgress?.('正在解析分支与引用...')

      // 1. Current Branch
      let currentBranch = 'main'
      try {
        currentBranch = (await git.currentBranch({ fs, dir: '/' })) || 'main'
      } catch {
        // Fallback
      }

      // 2. Local Branches
      let branchNames: string[] = []
      try {
        branchNames = await git.listBranches({ fs, dir: '/' })
      } catch {
        branchNames = [currentBranch]
      }
      if (!branchNames.includes(currentBranch)) {
        branchNames.unshift(currentBranch)
      }

      const branches = await Promise.all(
        branchNames.map(async (name) => {
          let tip = ''
          try {
            tip = await git.resolveRef({ fs, dir: '/', ref: name })
          } catch {
            // ignore
          }
          return {
            name,
            current: name === currentBranch,
            tip,
            upstream: '',
          }
        })
      )

      // 3. Tags
      let tags: { name: string; tip: string }[] = []
      try {
        const tagNames = await git.listTags({ fs, dir: '/' })
        tags = await Promise.all(
          tagNames.map(async (name) => {
            let tip = ''
            try {
              tip = await git.resolveRef({ fs, dir: '/', ref: name })
            } catch {
              // ignore
            }
            return { name, tip }
          })
        )
      } catch {
        // ignore
      }

      // 4. Remotes & Origin URL
      let remotes: GitRemoteBranch[] = []
      let remoteUrl = ''
      try {
        const rawRemotes = await git.listRemotes({ fs, dir: '/' })
        remotes = rawRemotes.map((r) => ({
          name: `${r.remote}/HEAD`,
          remote: r.remote,
          branch: 'HEAD',
          tip: '',
        }))
        const origin = rawRemotes.find((r) => r.remote === 'origin') || rawRemotes[0]
        if (origin) {
          remoteUrl = origin.url
        } else {
          const cfgUrl = await git.getConfig({ fs, dir: '/', path: 'remote.origin.url' })
          if (cfgUrl && typeof cfgUrl === 'string') {
            remoteUrl = cfgUrl
          }
        }
      } catch {
        // ignore
      }

      // 5. Commits
      options.onProgress?.('正在读取 Git 提交与构建图谱...')
      const headOid = await git.resolveRef({ fs, dir: '/', ref: 'HEAD' }).catch(() => '')
      const targetRef = branch || ref || currentBranch || 'HEAD'
      let commits: GitCommit[] = []
      let hasMore = false
      const skip = Math.max(0, Math.floor(options.skip || 0))
      const take = Math.max(1, Math.floor(options.take || GIT_LOG_PAGE_SIZE))
      try {
        const rawCommits = await git.log({
          fs,
          cache,
          dir: '/',
          ref: targetRef === '*' ? currentBranch : targetRef,
          depth: skip + take + 1,
        })

        const branchTips = new Map<string, string[]>()
        for (const b of branches) {
          if (b.tip) {
            const list = branchTips.get(b.tip) || []
            list.push(b.current && b.tip === headOid ? `HEAD -> ${b.name}` : b.name)
            branchTips.set(b.tip, list)
          }
        }
        if (headOid && !branchTips.get(headOid)?.some((name) => name.startsWith('HEAD -> '))) {
          branchTips.set(headOid, [...(branchTips.get(headOid) || []), 'HEAD'])
        }
        for (const t of tags) {
          if (t.tip) {
            const list = branchTips.get(t.tip) || []
            list.push(`tag: ${t.name}`)
            branchTips.set(t.tip, list)
          }
        }

        hasMore = rawCommits.length > skip + take
        commits = rawCommits.slice(skip, skip + take).map((item) => {
          const oid = item.oid
          const c = item.commit
          const refs = branchTips.get(oid) || []
          return {
            hash: oid,
            short: oid.slice(0, 7),
            parents: c.parent || [],
            author: c.author?.name || 'Unknown',
            date: c.author?.timestamp ? new Date(c.author.timestamp * 1000).toISOString() : new Date().toISOString(),
            subject: (c.message || '').split('\n')[0] || '',
            body: c.message || '',
            refs,
          }
        })
      } catch (error) {
        // An unborn branch has no history; read failures must not look like the last page.
        const resolvedRef = targetRef === '*' ? currentBranch : targetRef
        if (resolvedRef !== currentBranch || branches.some((item) => item.tip)) throw error
      }

      options.onProgress?.('正在核对工作区状态...')
      // Cap worktree status checking with a 1200ms timeout budget so slow disk I/O does not freeze the view
      let worktreeStatus: GitWorktree | null = null
      let worktreeTimer: ReturnType<typeof setTimeout> | undefined
      try {
        worktreeStatus = await Promise.race([
          reader.readWorktreeStatus(),
          new Promise<null>((resolve) => {
            worktreeTimer = setTimeout(() => resolve(null), 1200)
          }),
        ])
      } catch {
        worktreeStatus = null
      } finally {
        if (worktreeTimer) clearTimeout(worktreeTimer)
      }

      options.onProgress?.('准备完成，正在呈现图谱...')

      return {
        repo,
        remoteUrl,
        displayPath: handle.name,
        head: currentBranch,
        branch: currentBranch,
        branches,
        remotes,
        tags,
        stashes: [],
        worktrees: [],
        submodules: [],
        commits,
        hasMore,
        marks: {},
        worktree: worktreeStatus,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(msg)
    }
  }

  async readCommitDiff(options: ReadCommitDiffOptions): Promise<GitCommitChanges> {
    const { repo, hash } = options

    const gh = parseGitHubRepo(repo)
    if (gh) {
      return await readRemoteCommitChanges(repo, hash, options)
    }

    return (await this.repository(repo)).readChanges(options)
  }

  async readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }> {
    const { repo, hash, path } = options

    const gh = parseGitHubRepo(repo)
    if (gh) {
      const blob = await readRemoteBlobData(repo, hash, path)
      const binary = blob.bytes.slice(0, 8000).includes(0) || /^(image|audio|video)\//.test(blob.contentType)
      return { content: binary ? '' : new TextDecoder().decode(blob.bytes), binary }
    }

    return (await this.repository(repo)).readBlob(hash, path)
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

  async readBlame(_options: { repo: string; path: string; hash?: string }): Promise<Record<number, GitBlameLine>> {
    return {}
  }

  async addWorktree(_repo: string, _path: string, _branch?: string): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持 Worktree，请在本地模式使用')
  }
}
