import git from 'isomorphic-git'

import { GIT_LOG_PAGE_SIZE } from '@/lib/git/identity'
import {
  createEdgeFolder,
  deleteEdgeFolder,
  findDirectoryHandleId,
  getDirectoryHandle,
  getEdgeCatalog,
  getEdgeFolders,
  moveEdgeProject,
  removeEdgeProject,
  saveDirectoryHandle,
  saveEdgeRemoteProject,
} from '@/lib/git/indexeddb-handles'
import { uniqueLocalProject } from '@/lib/git/project-access'
import { parseRemoteUrl } from '@/lib/git/temporary-store'
import type { GitCommit, GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectHost, GitProjectView, GitRemoteBranch, GitWorktree } from '@/lib/git/types'
import { parseGitHubRepo, readRemoteBlobData, readRemoteCommitChanges, readRemoteGitLog } from '@/services/git/remote-provider'

import { EdgeRepositoryReader } from './edge-repository-reader'
import type { AddProjectPayload, AddRemoteProjectOptions, GitDeleteFolderResult, IGitDriver, ReadBlobOptions, ReadCommitDiffOptions, ReadLogOptions } from './types'

export class EdgeGitDriver implements IGitDriver {
  readonly mode = 'edge' as const
  private readonly repositories = new Map<string, Promise<EdgeRepositoryReader>>()

  private repository(repo: string): Promise<EdgeRepositoryReader> {
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
