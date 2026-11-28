import { normalizeRemote, projectId } from '@/lib/git/identity'
import { driverModeFromPathname, type RouteDriverMode, withDriverModePath } from '@/lib/git/route-mode'

export type RepositoryPersistence = 'temporary' | 'saved'
export type RepositoryLoadStatus = 'idle' | 'resolving' | 'loading' | 'ready' | 'error'

export interface ParsedRepoSlug {
  repoKey: string
  provider?: 'github' | 'gitlab' | 'generic'
  owner?: string
  repo?: string
  remoteUrl?: string
  resourceType: 'commit' | 'branch' | 'blob' | 'diff' | null
  resourceId?: string
  subPath?: string
}

export interface MakeShareUrlOptions {
  hash?: string
  file?: string
  lines?: string
  remoteUrl?: string
  mode?: RouteDriverMode
}

export function parseRepoSlug(slugParts: string[], remoteQueryParam?: string): ParsedRepoSlug | null {
  if (!slugParts || slugParts.length === 0) return null

  const parts = slugParts.map((p) => decodeURIComponent(p.trim())).filter(Boolean)
  if (parts.length === 0 || !parts[0]) return null

  let repoKey = ''
  let remainingIndex = 1
  let provider: 'github' | 'gitlab' | 'generic' | undefined
  let owner: string | undefined
  let repo: string | undefined
  let remoteUrl: string | undefined = remoteQueryParam?.trim() || undefined

  // Find where the resource keyword begins ('commit', 'branch', 'blob', 'diff')
  const keywordIndex = parts.findIndex((p) => ['commit', 'branch', 'blob', 'diff'].includes(p.toLowerCase()))
  const repoSlugParts = keywordIndex >= 0 ? parts.slice(0, keywordIndex) : parts
  remainingIndex = keywordIndex >= 0 ? keywordIndex : parts.length

  // Check provider or host
  if ((repoSlugParts[0] === 'github' || repoSlugParts[0] === 'gitlab') && repoSlugParts.length >= 2) {
    provider = repoSlugParts[0]
    repo = repoSlugParts[repoSlugParts.length - 1]
    owner = repoSlugParts.slice(1, repoSlugParts.length - 1).join('/')
    repoKey = `${provider}.com/${owner ? `${owner}/` : ''}${repo}`
    if (!remoteUrl) {
      remoteUrl = `https://${provider}.com/${owner ? `${owner}/` : ''}${repo}.git`
    }
  } else if (repoSlugParts[0].includes('.')) {
    // Custom domain, e.g. gitlab.mycorp.com/team/subgroup/ticket-janitor
    const host = repoSlugParts[0].toLowerCase()
    provider = host.includes('github') ? 'github' : host.includes('gitlab') ? 'gitlab' : 'generic'
    if (repoSlugParts.length >= 2) {
      repo = repoSlugParts[repoSlugParts.length - 1]
      owner = repoSlugParts.slice(1, repoSlugParts.length - 1).join('/')
      repoKey = `${host}/${owner ? `${owner}/` : ''}${repo}`
      if (!remoteUrl) {
        remoteUrl = `https://${host}/${owner ? `${owner}/` : ''}${repo}.git`
      }
    } else {
      repoKey = repoSlugParts.join('/')
      if (!remoteUrl) {
        remoteUrl = `https://${repoSlugParts.join('/')}.git`
      }
    }
  } else {
    // Opaque key or local/remote hash, e.g. /repo/r_xxx or /repo/l_xxx
    repoKey = repoSlugParts.join('/')
  }

  let resourceType: 'commit' | 'branch' | 'blob' | 'diff' | null = null
  let resourceId: string | undefined
  let subPath: string | undefined

  if (parts.length > remainingIndex) {
    const nextKeyword = parts[remainingIndex]?.toLowerCase()
    if (nextKeyword === 'commit' && parts.length > remainingIndex + 1) {
      resourceType = 'commit'
      resourceId = parts[remainingIndex + 1]
      if (parts[remainingIndex + 2] === 'diff') {
        subPath = 'diff'
      }
    } else if (nextKeyword === 'branch' && parts.length > remainingIndex + 1) {
      resourceType = 'branch'
      resourceId = parts.slice(remainingIndex + 1).join('/')
    } else if (nextKeyword === 'blob' && parts.length > remainingIndex + 2) {
      resourceType = 'blob'
      resourceId = parts[remainingIndex + 1]
      subPath = parts.slice(remainingIndex + 2).join('/')
    }
  }

  return {
    repoKey,
    provider,
    owner,
    repo,
    remoteUrl,
    resourceType,
    resourceId,
    subPath,
  }
}

export function generateRepoKey(remoteUrlOrKey: string): string {
  const identity = normalizeRemote(remoteUrlOrKey)
  if (identity) {
    return `r_${projectId(identity.key)}`
  }
  return `l_${projectId(remoteUrlOrKey)}`
}

export function makeShareUrl(repoPathOrUrl: string, optionsOrHash?: string | MakeShareUrlOptions, explicitRemoteUrl?: string): string {
  const options: MakeShareUrlOptions = typeof optionsOrHash === 'string' ? { hash: optionsOrHash, remoteUrl: explicitRemoteUrl } : optionsOrHash || {}

  const remoteTarget = options.remoteUrl || explicitRemoteUrl || repoPathOrUrl
  const identity = normalizeRemote(remoteTarget)

  let base = ''
  if (identity) {
    if (identity.host === 'github.com') {
      const parts = identity.key.replace(/^github\.com\//, '').split('/')
      if (parts.length >= 2) {
        const owner = parts.slice(0, parts.length - 1).join('/')
        const repo = parts[parts.length - 1]
        base = options.hash ? `/git/github/${owner}/${repo}/commit/${options.hash}` : `/git/github/${owner}/${repo}`
      }
    } else if (identity.host === 'gitlab.com') {
      const parts = identity.key.replace(/^gitlab\.com\//, '').split('/')
      if (parts.length >= 2) {
        const owner = parts.slice(0, parts.length - 1).join('/')
        const repo = parts[parts.length - 1]
        base = options.hash ? `/git/gitlab/${owner}/${repo}/commit/${options.hash}` : `/git/gitlab/${owner}/${repo}`
      }
    } else {
      // Enterprise self-hosted GitLab / Custom host
      base = options.hash ? `/git/${identity.key}/commit/${options.hash}` : `/git/${identity.key}`
    }
  }

  if (!base) {
    // Pure offline local repository
    const repoKey = `l_${projectId(repoPathOrUrl)}`
    base = options.hash ? `/git/${repoKey}/commit/${options.hash}` : `/git/${repoKey}`
  }

  const url = new URL(base, 'http://localhost')
  if (options.file) {
    url.searchParams.set('file', options.file)
  }
  // Include explicit remote clone url for corporate or custom self-hosted GitLab/Git hosts
  if (identity && identity.host !== 'github.com' && identity.host !== 'gitlab.com') {
    url.searchParams.set('remote', identity.httpsUrl)
  }

  const activeMode: RouteDriverMode = options.mode ?? (typeof window !== 'undefined' ? driverModeFromPathname(window.location?.pathname) : 'edge')
  const canonicalPath = withDriverModePath(url.pathname, activeMode)
  let finalPath = `${canonicalPath}${url.search}`
  if (options.lines) {
    finalPath += `#L${options.lines}`
  }
  return finalPath
}
