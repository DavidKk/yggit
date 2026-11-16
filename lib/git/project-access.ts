import { normalizeRemote } from '@/lib/git/identity'
import type { GitLogView, GitProjectView } from '@/lib/git/types'
import { parseGitHubRepo } from '@/services/git/remote-provider'

/** Compare repository identity without conflating unrelated repos sharing a name. */
export function remoteIdentity(url: string): string {
  const identity = normalizeRemote(url)
  if (!identity) return ''
  return identity.host === 'github.com' ? identity.key.toLowerCase() : identity.key
}

export function projectOpenTarget(project: GitProjectView): string {
  if (project.localPath) return project.localPath
  return parseGitHubRepo(project.httpsUrl) ? project.httpsUrl : ''
}

export function hasSavedRemote(projects: GitProjectView[], url: string): boolean {
  const identity = remoteIdentity(url)
  return Boolean(identity) && projects.some((project) => remoteIdentity(project.httpsUrl) === identity)
}

/** Preserve every local directory while absorbing its remote-only catalog entries. */
export function consolidateProjects(projects: GitProjectView[]): GitProjectView[] {
  const localRemotes = new Set(
    projects
      .filter((project) => project.localPath)
      .map((project) => remoteIdentity(project.httpsUrl))
      .filter(Boolean)
  )
  const seen = new Set<string>()
  return projects.filter((project) => {
    if (project.localPath) return true
    const key = remoteIdentity(project.httpsUrl)
    if (!key) return true
    if (localRemotes.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function uniqueLocalProject(projects: GitProjectView[], url: string): GitProjectView | undefined {
  const key = remoteIdentity(url)
  if (!key) return undefined
  const matches = projects.filter((project) => project.localPath && remoteIdentity(project.httpsUrl) === key)
  return matches.length === 1 ? matches[0] : undefined
}

export function projectSource(project: GitProjectView): string {
  return project.localPath || normalizeRemote(project.httpsUrl)?.key || project.httpsUrl || project.id
}

export interface ResolvedRemoteSource {
  name: string
  url: string
  webUrl: string
  isPrivate: boolean
}

export type RemoteCloudType = 'none' | 'single-public' | 'single-private' | 'mixed'

/** Check if a remote repository is a private corporate/enterprise or authenticated repository */
export function isPrivateRemote(url: string, authorized?: boolean): boolean {
  if (authorized) return true
  const trimmed = (url || '').trim()
  if (!trimmed) return false

  const identity = normalizeRemote(trimmed)
  if (!identity) {
    return true
  }

  const host = identity.host.toLowerCase()
  const isPublicHost = host === 'github.com' || host === 'gitlab.com' || host === 'gitee.com'
  if (!isPublicHost) return true

  // If URL has user credentials or internal token in it
  if (trimmed.includes('@') && !trimmed.startsWith('git@github.com') && !trimmed.startsWith('git@gitlab.com') && !trimmed.startsWith('git@gitee.com')) {
    return true
  }

  return false
}

/** Get web-accessible browser URL from Git remote URL */
export function getWebUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed) return ''
  const identity = normalizeRemote(trimmed)
  if (identity?.httpsUrl) {
    return identity.httpsUrl.replace(/\.git$/, '')
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\.git$/, '')
  }
  return trimmed
}

/** Extract and resolve all remote sources for a project */
export function extractProjectRemotes(project: GitProjectView): ResolvedRemoteSource[] {
  const result: ResolvedRemoteSource[] = []
  const seenUrls = new Set<string>()

  if (project.remotes && project.remotes.length > 0) {
    for (const r of project.remotes) {
      if (!r.url || seenUrls.has(r.url)) continue
      seenUrls.add(r.url)
      result.push({
        name: r.name || 'origin',
        url: r.url,
        webUrl: getWebUrl(r.url),
        isPrivate: typeof r.isPrivate === 'boolean' ? r.isPrivate : isPrivateRemote(r.url, project.authorized),
      })
    }
  }

  if (result.length === 0 && project.httpsUrl) {
    result.push({
      name: 'origin',
      url: project.httpsUrl,
      webUrl: getWebUrl(project.httpsUrl),
      isPrivate: isPrivateRemote(project.httpsUrl, project.authorized),
    })
  }

  return result
}

/**
 * Determine the cloud icon state:
 * - 'none': No remote sources
 * - 'single-public': Exactly one open-source / public remote -> Public Cloud icon
 * - 'single-private': Exactly one private remote -> Private Cloud icon (TbCloudLock)
 * - 'mixed': Multiple remotes (or mixed public and private) -> Default Cloud icon with dropdown
 */
export function getRemoteCloudType(remotes: ResolvedRemoteSource[]): RemoteCloudType {
  if (remotes.length === 0) return 'none'
  if (remotes.length === 1) {
    return remotes[0].isPrivate ? 'single-private' : 'single-public'
  }
  return 'mixed'
}

/** Browser directory IDs identify storage records, not names to display. */
export function projectDisplayName(view: GitLogView, projects: GitProjectView[]): string {
  const project = projects.find((item) => item.localPath === view.repo || (item.httpsUrl && remoteIdentity(item.httpsUrl) === remoteIdentity(view.repo)))
  if (project?.name) return project.name
  const path = view.displayPath || view.repo
  return path.split('/').filter(Boolean).at(-1) || path
}
