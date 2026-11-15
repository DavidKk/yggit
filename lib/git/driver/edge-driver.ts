import git from 'isomorphic-git'

import {
  createEdgeFolder,
  deleteEdgeFolder,
  getDirectoryHandle,
  getEdgeCatalog,
  getEdgeFolders,
  moveEdgeProject,
  removeEdgeProject,
  saveDirectoryHandle,
  saveEdgeRemoteProject,
} from '@/lib/git/indexeddb-handles'
import { parseRemoteUrl } from '@/lib/git/temporary-store'
import type { GitCommit, GitCommitChanges, GitFileChange, GitLogView, GitProjectCatalog, GitProjectHost, GitProjectView, GitRemoteBranch } from '@/lib/git/types'
import { parseGitHubRepo, readRemoteCommitChanges, readRemoteGitLog } from '@/services/git/remote-provider'

import { createDirectoryHandleFs } from './handle-fs'
import type { AddProjectPayload, AddRemoteProjectOptions, GitDeleteFolderResult, IGitDriver, ReadBlobOptions, ReadCommitDiffOptions, ReadLogOptions } from './types'

export class EdgeGitDriver implements IGitDriver {
  readonly mode = 'edge' as const

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' || typeof global !== 'undefined'
  }

  async readLog(options: ReadLogOptions): Promise<GitLogView> {
    const { repo, branch, ref } = options

    // Check if it's a GitHub remote repo
    const gh = parseGitHubRepo(repo)
    if (gh) {
      return await readRemoteGitLog(repo, branch || ref)
    }

    // Check if it's a local folder backed by IndexedDB directory handle
    const handle = await getDirectoryHandle(repo)
    if (!handle) {
      throw new Error(`RESOURCE_UNRESOLVED: Directory handle for "${repo}" not found in browser storage.`)
    }

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

      const fs = createDirectoryHandleFs(handle)

      // Verify that this is a git directory
      try {
        await fs.promises.stat('/.git')
      } catch {
        throw new Error(`NOT_A_GIT_REPO: Directory "${handle.name}" does not contain a .git folder.`)
      }

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
      const targetRef = branch || ref || currentBranch || 'HEAD'
      let commits: GitCommit[] = []
      try {
        const rawCommits = await git.log({
          fs,
          dir: '/',
          ref: targetRef === '*' ? currentBranch : targetRef,
          depth: 100,
        })

        const branchTips = new Map<string, string[]>()
        for (const b of branches) {
          if (b.tip) {
            const list = branchTips.get(b.tip) || []
            list.push(b.name)
            branchTips.set(b.tip, list)
          }
        }
        for (const t of tags) {
          if (t.tip) {
            const list = branchTips.get(t.tip) || []
            list.push(`tag: ${t.name}`)
            branchTips.set(t.tip, list)
          }
        }

        commits = rawCommits.map((item) => {
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
      } catch {
        // Fallback or empty commits if log fails
      }

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
        hasMore: false,
        marks: {},
        worktree: null,
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
      return await readRemoteCommitChanges(repo, hash)
    }

    const handle = await getDirectoryHandle(repo)
    if (!handle) {
      throw new Error(`RESOURCE_UNRESOLVED: Directory handle for "${repo}" not found.`)
    }

    const fs = createDirectoryHandleFs(handle)
    const files: GitFileChange[] = []

    try {
      const commitObj = await git.readCommit({ fs, dir: '/', oid: hash })
      const parentOid = commitObj?.commit?.parent?.[0]

      await git.walk({
        fs,
        dir: '/',
        trees: [git.TREE({ ref: parentOid || undefined }), git.TREE({ ref: hash })],
        map: async function (filepath, [parentEntry, headEntry]) {
          if (filepath === '.') return
          const parentType = parentEntry ? await parentEntry.type() : null
          const headType = headEntry ? await headEntry.type() : null
          if (parentType === 'tree' || headType === 'tree') return

          if (!parentEntry && headEntry) {
            files.push({ path: filepath, status: 'add', oldPath: filepath })
          } else if (parentEntry && !headEntry) {
            files.push({ path: filepath, status: 'delete', oldPath: filepath })
          } else if (parentEntry && headEntry) {
            const pOid = await parentEntry.oid()
            const hOid = await headEntry.oid()
            if (pOid !== hOid) {
              files.push({ path: filepath, status: 'modify', oldPath: filepath })
            }
          }
        },
      })
    } catch {
      // Fallback
    }

    return {
      hash,
      files,
      patch: '',
      truncated: false,
    }
  }

  async readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }> {
    const { repo, hash, path } = options

    const gh = parseGitHubRepo(repo)
    if (gh) {
      const rawUrl = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${hash}/${path}`
      const res = await fetch(rawUrl)
      if (!res.ok) {
        throw new Error(`Failed to load blob from GitHub (${res.status})`)
      }
      const text = await res.text()
      const contentType = res.headers.get('content-type') || ''
      const binary = !contentType.startsWith('text/') && !contentType.includes('json') && !contentType.includes('javascript')
      return { content: text, binary }
    }

    const handle = await getDirectoryHandle(repo)
    if (!handle) {
      throw new Error(`RESOURCE_UNRESOLVED: Directory handle for "${repo}" not found.`)
    }

    const fs = createDirectoryHandleFs(handle)
    try {
      const { blob } = await git.readBlob({ fs, dir: '/', oid: hash, filepath: path })
      // Check for binary by looking for null bytes in sample
      const sample = blob.subarray(0, 8000)
      let isBinary = false
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) {
          isBinary = true
          break
        }
      }
      if (isBinary) {
        return { content: '', binary: true }
      }
      const text = new TextDecoder('utf-8').decode(blob)
      return { content: text, binary: false }
    } catch {
      // Fallback: read directly from directory handle if git object read fails
      const pathParts = path.split('/').filter(Boolean)
      let curDir = handle
      for (let i = 0; i < pathParts.length - 1; i++) {
        curDir = await curDir.getDirectoryHandle(pathParts[i])
      }
      const fileHandle = await curDir.getFileHandle(pathParts[pathParts.length - 1])
      const file = await fileHandle.getFile()
      const text = await file.text()
      return {
        content: text,
        binary: false,
      }
    }
  }

  async getProjects(): Promise<GitProjectCatalog> {
    return getEdgeCatalog()
  }

  async addProject(payload: AddProjectPayload): Promise<GitProjectView> {
    const id = payload.pathOrUrl
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
        localPath: payload.handle.name,
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
