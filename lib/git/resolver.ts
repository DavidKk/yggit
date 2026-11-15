import { normalizeRemote, projectId } from '@/lib/git/identity'

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

export function parseRepoSlug(slugParts: string[]): ParsedRepoSlug | null {
  if (!slugParts || slugParts.length === 0) return null

  const parts = slugParts.map((p) => decodeURIComponent(p.trim())).filter(Boolean)
  if (parts.length === 0 || !parts[0]) return null

  let repoKey = ''
  let remainingIndex = 1
  let provider: 'github' | 'gitlab' | 'generic' | undefined
  let owner: string | undefined
  let repo: string | undefined
  let remoteUrl: string | undefined

  // 1. Check if provider prefix: /repo/github/owner/repo or /repo/gitlab/owner/repo
  if ((parts[0] === 'github' || parts[0] === 'gitlab') && parts.length >= 3) {
    provider = parts[0]
    owner = parts[1]
    repo = parts[2]
    repoKey = `${provider}.com/${owner}/${repo}`
    remoteUrl = `https://${provider}.com/${owner}/${repo}.git`
    remainingIndex = 3
  } else if (parts[0].includes('.') && parts.length >= 3) {
    // 2. Custom host with dot, e.g. /repo/git.corp.com/group/project
    const host = parts[0].toLowerCase()
    provider = host.includes('github') ? 'github' : host.includes('gitlab') ? 'gitlab' : 'generic'
    owner = parts[1]
    repo = parts[2]
    repoKey = `${host}/${owner}/${repo}`
    remoteUrl = `https://${host}/${owner}/${repo}.git`
    remainingIndex = 3
  } else {
    // 3. Opaque key or local/remote hash, e.g. /repo/r_xxx or /repo/l_xxx
    repoKey = parts[0]
    remainingIndex = 1
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

export function makeShareUrl(repoPathOrUrl: string, hash?: string, remoteUrl?: string): string {
  const remoteTarget = remoteUrl || repoPathOrUrl
  const identity = normalizeRemote(remoteTarget)
  if (identity) {
    if (identity.host === 'github.com') {
      const parts = identity.key.replace(/^github\.com\//, '').split('/')
      if (parts.length >= 2) {
        const owner = parts[0]
        const repo = parts.slice(1).join('/')
        return hash ? `/repo/github/${owner}/${repo}/commit/${hash}` : `/repo/github/${owner}/${repo}`
      }
    }
    if (identity.host === 'gitlab.com') {
      const parts = identity.key.replace(/^gitlab\.com\//, '').split('/')
      if (parts.length >= 2) {
        const owner = parts[0]
        const repo = parts.slice(1).join('/')
        return hash ? `/repo/gitlab/${owner}/${repo}/commit/${hash}` : `/repo/gitlab/${owner}/${repo}`
      }
    }
    // Generic or corporate git host: /repo/{host}/{path}/commit/{hash}
    return hash ? `/repo/${identity.key}/commit/${hash}` : `/repo/${identity.key}`
  }

  // Pure offline local repository
  const repoKey = `l_${projectId(repoPathOrUrl)}`
  return hash ? `/repo/${repoKey}/commit/${hash}` : `/repo/${repoKey}`
}
