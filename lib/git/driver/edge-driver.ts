import { getDirectoryHandle, listDirectoryHandles, saveDirectoryHandle } from '@/lib/git/indexeddb-handles'
import { getTemporaryRepos } from '@/lib/git/temporary-store'
import type { GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectView } from '@/lib/git/types'
import { parseGitHubRepo, readRemoteCommitChanges, readRemoteGitLog } from '@/services/git/remote-provider'

import type { AddProjectPayload, IGitDriver, ReadBlobOptions, ReadCommitDiffOptions, ReadLogOptions } from './types'

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

    // If handle exists, read via isomorphic-git or browser filesystem
    // We dynamically import isomorphic-git to avoid server-side bundle overhead
    const git = await import('isomorphic-git')
    // We can also leverage isomorphic-git's fs adapter or LightningFS
    try {
      // In browser with FileSystemDirectoryHandle, check permissions
      const perm = typeof handle.queryPermission === 'function' ? await handle.queryPermission({ mode: 'read' }) : 'granted'
      if (perm !== 'granted') {
        throw new Error(`PERMISSION_REQUIRED: Read permission needed for directory "${handle.name}".`)
      }

      // Check for .git directory inside handle
      let gitDirHandle: FileSystemDirectoryHandle | null = null
      try {
        gitDirHandle = await handle.getDirectoryHandle('.git')
      } catch {
        throw new Error(`NOT_A_GIT_REPO: Directory "${handle.name}" does not contain a .git folder.`)
      }

      // Read HEAD
      let head = 'main'
      try {
        const headFileHandle = await gitDirHandle.getFileHandle('HEAD')
        const file = await headFileHandle.getFile()
        const text = (await file.text()).trim()
        head = text.replace(/^ref:\s*refs\/heads\//, '')
      } catch {
        // Fallback
      }

      // Return synthetic view if full pack parse is deferred
      return {
        repo,
        displayPath: handle.name,
        head,
        branch: head,
        branches: [{ name: head, current: true, tip: '', upstream: '' }],
        remotes: [],
        tags: [],
        stashes: [],
        worktrees: [],
        submodules: [],
        commits: [],
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

    // Return empty changes fallback for local edge handle if not parsed
    return {
      hash,
      files: [],
      patch: '',
      truncated: false,
    }
  }

  async readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }> {
    const { repo, hash, path } = options

    const gh = parseGitHubRepo(repo)
    if (gh) {
      // Fetch via raw.githubusercontent.com
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

    // Resolve file from handle directly
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

  async getProjects(): Promise<GitProjectCatalog> {
    const handles = await listDirectoryHandles()
    const tempRepos = getTemporaryRepos()

    const handleProjects: GitProjectView[] = handles.map((h) => ({
      id: h.id,
      name: h.name,
      group: '本地存储 (Web FS)',
      host: 'local',
      localPath: h.name,
      httpsUrl: '',
      local: true,
      remote: false,
      authorized: true,
    }))

    const tempProjects: GitProjectView[] = tempRepos.map((r) => ({
      id: r.fingerprint,
      name: r.name,
      group: r.provider === 'github' ? 'GitHub (Edge)' : 'GitLab (Edge)',
      host: r.provider === 'github' ? 'github' : 'gitlab',
      localPath: '',
      httpsUrl: r.remoteUrl,
      local: false,
      remote: true,
      authorized: true,
    }))

    return {
      projects: [...handleProjects, ...tempProjects],
      folders: ['本地存储 (Web FS)', 'GitHub (Edge)', 'GitLab (Edge)'],
    }
  }

  async addProject(payload: AddProjectPayload): Promise<GitProjectView> {
    const id = payload.pathOrUrl
    if (payload.handle) {
      await saveDirectoryHandle(id, payload.handle, payload.name)
      return {
        id,
        name: payload.name || payload.handle.name || id,
        group: '本地存储 (Web FS)',
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
      group: '远程仓库 (Edge)',
      host: id.includes('github') ? 'github' : 'gitlab',
      localPath: '',
      httpsUrl: id,
      local: false,
      remote: true,
      authorized: true,
    }
  }
}
