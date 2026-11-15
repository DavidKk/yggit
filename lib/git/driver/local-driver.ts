import type { GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectView } from '@/lib/git/types'

import type {
  AddProjectPayload,
  AddRemoteProjectOptions,
  GitDeleteFolderResult,
  IGitDriver,
  ReadBlobOptions,
  ReadCommitDiffOptions,
  ReadLogOptions,
} from './types'

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
    if (options.skip) params.set('skip', String(options.skip))

    const res = await fetch(`/api/git/log?${params.toString()}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Failed to read git log (${res.status})`)
    }
    return (await res.json()) as GitLogView
  }

  async readCommitDiff(options: ReadCommitDiffOptions): Promise<GitCommitChanges> {
    const params = new URLSearchParams()
    if (options.repo) params.set('repo', options.repo)
    if (options.hash) params.set('hash', options.hash)
    if (options.tree) params.set('tree', '1')
    if (options.file) params.set('path', options.file)
    if (options.all) params.set('all', '1')

    const res = await fetch(`/api/git/commit?${params.toString()}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Failed to read commit diff (${res.status})`)
    }
    return (await res.json()) as GitCommitChanges
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

  async getProjects(): Promise<GitProjectCatalog> {
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
      throw new Error(data.message || data.error || 'Failed to create folder')
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
      throw new Error(data.message || data.error || 'Failed to delete folder')
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
      throw new Error(data.message || data.error || 'Failed to move project')
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
      throw new Error(data.message || data.error || 'Failed to remove project')
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
      throw new Error(data.message || data.error || 'Failed to add remote project')
    }
    return {
      projects: data.projects || [],
      folders: data.folders || [],
    }
  }
}
