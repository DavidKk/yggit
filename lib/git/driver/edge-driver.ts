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
import { isPrivateRemote, remoteIdentity, uniqueLocalProject } from '@/lib/git/project-access'
import { listRemoteGroup } from '@/lib/git/remote-groups'
import { parseRemoteUrl } from '@/lib/git/temporary-store'
import type { GitCommit, GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectHost, GitProjectView, GitRemoteBranch, GitRemoteSource, GitWorktree } from '@/lib/git/types'
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

  async deleteBranch(repo: string, branch: string, _force?: boolean): Promise<{ ok: boolean; message: string }> {
    const reader = await this.repository(repo)
    const { fs } = reader
    try {
      await git.deleteBranch({ fs, dir: '/', ref: branch })
      return { ok: true, message: `已删除分支 ${branch}` }
    } catch (error) {
      throw new Error(`删除分支失败: ${error instanceof Error ? error.message : String(error)}`)
    }
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

  async pull(repo: string, options?: GitPullOptions): Promise<{ ok: boolean; message: string }> {
    // 1. Try sync via local backend if repository matches a local path or registered project
    try {
      const res = await fetch('/api/git/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', repo, ...options }),
      })
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; message?: string }
        if (data.ok) return { ok: true, message: data.message || '拉取成功' }
      }
    } catch {
      // Fallback to browser isomorphic-git
    }

    // 2. Edge isomorphic-git fast-forward pull
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
    // 1. Try sync via local backend if repository matches a local path or registered project
    try {
      const res = await fetch('/api/git/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch', repo, ...options }),
      })
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; message?: string }
        if (data.ok) {
          this.repositories.delete(repo)
          return { ok: true, message: data.message || '抓取成功' }
        }
      }
    } catch {
      // Backend not reachable, fall back to browser isomorphic-git
    }

    // 2. Browser isomorphic-git fetch into filesystem directory handle
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

  async getRemotes(repo: string): Promise<GitRemoteSource[]> {
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

  async addRemote(repo: string, name: string, url: string, _pushUrl?: string): Promise<{ ok: boolean; message: string }> {
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
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      const remotes = await git.listRemotes({ fs, dir: '/' })
      const target = remotes.find((r) => r.remote === oldName)
      if (!target?.url) throw new Error(`未找到远程源 ${oldName}`)
      await git.deleteRemote({ fs, dir: '/', remote: oldName })
      await git.addRemote({ fs, dir: '/', remote: newName, url: target.url, force: true })
      return { ok: true, message: `远程源已重命名为 ${newName}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '重命名远程源失败' }
    }
  }

  async removeRemote(repo: string, remote: string): Promise<{ ok: boolean; message: string }> {
    try {
      const reader = await this.repository(repo)
      const { fs } = reader
      await git.deleteRemote({ fs, dir: '/', remote })
      return { ok: true, message: `成功删除远程源 ${remote}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '删除远程源失败' }
    }
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

  clearCache(repo?: string): void {
    if (repo) {
      this.repositories.delete(repo)
    } else {
      this.repositories.clear()
    }
  }

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' || typeof global !== 'undefined'
  }

  async readLog(options: ReadLogOptions): Promise<GitLogView> {
    if (!options.repo || !options.repo.trim()) {
      throw new Error('未指定项目仓库路径')
    }
    const { branch, ref } = options
    const edgeProjects = typeof getEdgeCatalog === 'function' ? (await getEdgeCatalog().catch(() => ({ projects: [] }))).projects || [] : []
    const localMatch = uniqueLocalProject(edgeProjects, options.repo)?.localPath
    const repo = localMatch || (parseGitHubRepo(options.repo) ? options.repo : options.repo)

    // Check if it's a GitHub remote repo
    const gh = parseGitHubRepo(repo)
    if (gh && !localMatch) {
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
          let upstream = ''
          let ahead: number | undefined
          let behind: number | undefined
          try {
            const remoteCfg = await git.getConfig({ fs, dir: '/', path: `branch.${name}.remote` })
            const mergeCfg = await git.getConfig({ fs, dir: '/', path: `branch.${name}.merge` })
            if (remoteCfg && mergeCfg && typeof remoteCfg === 'string' && typeof mergeCfg === 'string') {
              const mergeBranch = mergeCfg.replace(/^refs\/heads\//, '')
              upstream = `${remoteCfg}/${mergeBranch}`
              const remoteTip = await git.resolveRef({ fs, dir: '/', ref: `refs/remotes/${upstream}` }).catch(() => '')
              if (tip && remoteTip && tip === remoteTip) {
                ahead = 0
                behind = 0
              }
            }
          } catch {
            // ignore
          }
          return {
            name,
            current: name === currentBranch,
            tip,
            upstream,
            ahead,
            behind,
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
      const remotes: GitRemoteBranch[] = []
      const remoteSources: GitRemoteSource[] = []
      let remoteUrl = ''
      try {
        const rawRemotes = await git.listRemotes({ fs, dir: '/' })
        for (const r of rawRemotes) {
          if (!r.remote) continue
          const branchNames = await git.listBranches({ fs, dir: '/', remote: r.remote }).catch(() => [])
          // If a remote has no branches and no url (such as empty glab-base stub), ignore it
          if (!branchNames.length && !r.url) continue

          if (r.url && !remoteSources.some((item) => item.name === r.remote)) {
            remoteSources.push({
              name: r.remote,
              url: r.url,
              isPrivate: isPrivateRemote(r.url),
            })
            if (!remoteUrl || r.remote === 'origin') {
              remoteUrl = r.url
            }
          }

          for (const b of branchNames) {
            if (!b || b === 'HEAD') continue
            const tip = await git.resolveRef({ fs, dir: '/', ref: `refs/remotes/${r.remote}/${b}` }).catch(() => '')
            const fullName = `${r.remote}/${b}`
            if (!remotes.some((item) => item.name === fullName)) {
              remotes.push({
                name: fullName,
                remote: r.remote,
                branch: b,
                tip,
              })
            }
          }
        }

        if (!remoteUrl) {
          const cfgUrl = await git.getConfig({ fs, dir: '/', path: 'remote.origin.url' })
          if (cfgUrl && typeof cfgUrl === 'string') {
            remoteUrl = cfgUrl
          }
        }
      } catch {
        // ignore
      }

      // 4b. Stashes
      let stashes: GitLogView['stashes'] = []
      try {
        const stashLog = (await fs.promises.readFile('/.git/logs/refs/stash', 'utf8').catch(() => '')) as string
        if (stashLog) {
          const lines = stashLog.trim().split('\n').filter(Boolean)
          stashes = lines
            .map((line, idx) => {
              const [header, ...rest] = line.split('\t')
              const subject = rest.join('\t')
              const parts = header.trim().split(' ')
              const hash = parts[1] || ''
              const timestamp = parts[parts.length - 2]
              const date = timestamp ? new Date(parseInt(timestamp, 10) * 1000).toISOString() : new Date().toISOString()
              const reverseIndex = lines.length - 1 - idx
              return {
                name: `stash@{${reverseIndex}}`,
                hash,
                base: '',
                date,
                subject: subject || `WIP on ${currentBranch}`,
              }
            })
            .reverse()
        }
      } catch {
        stashes = []
      }

      // 5. Commits
      options.onProgress?.('正在读取 Git 提交与构建图谱...')
      const headOid = await git.resolveRef({ fs, dir: '/', ref: 'HEAD' }).catch(() => '')
      const targetRef = branch || ref || currentBranch || 'HEAD'
      let commits: GitCommit[] = []
      let hasMore = false
      let hasPrev = false
      let startIndex = Math.max(0, Math.floor(options.skip || 0))
      const take = Math.max(1, Math.floor(options.take || GIT_LOG_PAGE_SIZE))
      try {
        const rawCommits = await git.log({
          fs,
          cache,
          dir: '/',
          ref: targetRef === '*' ? currentBranch : targetRef,
          depth: options.locate ? 5000 : startIndex + take + 1,
        })

        if (options.locate) {
          const clean = options.locate.trim().toLowerCase()
          const locatedIdx = rawCommits.findIndex((c) => c.oid.toLowerCase() === clean || (clean.length >= 7 && c.oid.toLowerCase().startsWith(clean)))
          if (locatedIdx >= 0) {
            const half = Math.floor(take / 2)
            startIndex = Math.max(0, locatedIdx - half)
          }
        }

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
        for (const r of remotes) {
          if (r.tip) {
            const list = branchTips.get(r.tip) || []
            if (!list.includes(r.name)) {
              list.push(r.name)
              branchTips.set(r.tip, list)
            }
          }
        }

        hasMore = rawCommits.length > startIndex + take
        hasPrev = startIndex > 0
        commits = rawCommits.slice(startIndex, startIndex + take).map((item) => {
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
        remoteSources,
        tags,
        stashes,
        worktrees: [],
        submodules: [],
        commits,
        hasMore,
        hasPrev,
        startIndex,
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

  async readBlame(options: { repo: string; path: string; hash?: string }): Promise<Record<number, GitBlameLine>> {
    try {
      const edgeProjects = typeof getEdgeCatalog === 'function' ? (await getEdgeCatalog().catch(() => ({ projects: [] }))).projects || [] : []
      const localMatch = uniqueLocalProject(edgeProjects, options.repo)?.localPath
      const repo = localMatch || options.repo
      const reader = await this.repository(repo)
      const { fs, cache } = reader
      const targetRef = options.hash && options.hash !== 'WORKTREE' ? options.hash : 'HEAD'

      let rawCommits = await git
        .log({
          fs,
          cache,
          dir: '/',
          filepath: options.path,
          ref: targetRef,
          depth: 50,
        })
        .catch(() => [])

      if (rawCommits.length === 0 && targetRef !== 'HEAD') {
        rawCommits = await git
          .log({
            fs,
            cache,
            dir: '/',
            filepath: options.path,
            ref: 'HEAD',
            depth: 50,
          })
          .catch(() => [])
      }

      if (rawCommits.length === 0) return {}

      const blob = await this.readBlob({ repo: options.repo, path: options.path, hash: targetRef }).catch(() => ({ content: '' }))
      if (!blob.content) return {}

      const totalLines = blob.content.replace(/\n$/, '').split('\n').length
      const latest = rawCommits[0]
      const blameMap: Record<number, GitBlameLine> = {}

      for (let i = 1; i <= totalLines; i++) {
        blameMap[i] = {
          line: i,
          hash: latest.oid,
          author: latest.commit.author?.name || 'Unknown',
          authorMail: latest.commit.author?.email || '',
          date: latest.commit.author?.timestamp ? new Date(latest.commit.author.timestamp * 1000).toISOString() : new Date().toISOString(),
          summary: (latest.commit.message || '').split('\n')[0] || '',
        }
      }
      return blameMap
    } catch {
      return {}
    }
  }

  async readFileHistory(options: { repo: string; path: string; ref?: string; limit?: number }): Promise<{ commits: GitCommit[] }> {
    try {
      const edgeProjects = typeof getEdgeCatalog === 'function' ? (await getEdgeCatalog().catch(() => ({ projects: [] }))).projects || [] : []
      const localMatch = uniqueLocalProject(edgeProjects, options.repo)?.localPath
      const repo = localMatch || options.repo
      const reader = await this.repository(repo)
      const { fs, cache } = reader
      const targetRef = options.ref && options.ref !== 'WORKTREE' ? options.ref : 'HEAD'
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 500) : 100

      let rawCommits = await git
        .log({
          fs,
          cache,
          dir: '/',
          filepath: options.path,
          ref: targetRef,
          depth: limit,
        })
        .catch(() => [])

      if (rawCommits.length === 0 && targetRef !== 'HEAD') {
        rawCommits = await git
          .log({
            fs,
            cache,
            dir: '/',
            filepath: options.path,
            ref: 'HEAD',
            depth: limit,
          })
          .catch(() => [])
      }

      const commits: GitCommit[] = rawCommits.map((c) => {
        const oid = c.oid
        return {
          hash: oid,
          short: oid.slice(0, 7),
          parents: c.commit.parent || [],
          author: c.commit.author?.name || 'Unknown',
          date: c.commit.author?.timestamp ? new Date(c.commit.author.timestamp * 1000).toISOString() : new Date().toISOString(),
          subject: (c.commit.message || '').split('\n')[0] || '',
          refs: [],
        }
      })
      return { commits }
    } catch {
      return { commits: [] }
    }
  }

  async addWorktree(_repo: string, _path: string, _branch?: string): Promise<{ ok: boolean; message: string }> {
    throw new Error('浏览器 Edge 模式暂不支持 Worktree，请在本地模式使用')
  }
}
