import fs from 'node:fs'

import { normalizeRemote, projectId } from '@/lib/git/identity'
import { type ParsedRepoSlug, parseRepoSlug, type RepositoryPersistence } from '@/lib/git/resolver'
import type { GitProjectView } from '@/lib/git/types'
import { listGitProjects } from '@/services/git/projects'
import { parseGitHubRepo } from '@/services/git/remote-provider'

export interface ResolvedRepo {
  repoPathOrUrl: string
  name: string
  source: 'local' | 'remote'
  persistence: RepositoryPersistence
  project?: GitProjectView
  error?: string
  unresolvedIdentity?: {
    key: string
    remoteUrl?: string
    name: string
    commitHash?: string
  }
}

export function resolveRepoSlug(slugParts: string[], remoteQueryParam?: string): { parsed: ParsedRepoSlug; resolved: ResolvedRepo } {
  const parsed = parseRepoSlug(slugParts, remoteQueryParam)
  if (!parsed) {
    return {
      parsed: { repoKey: '', resourceType: null },
      resolved: {
        repoPathOrUrl: '',
        name: '',
        source: 'local',
        persistence: 'temporary',
        error: '无效的仓库 URL 格式',
      },
    }
  }

  const projects = listGitProjects()
  const key = parsed.repoKey.toLowerCase()

  // 1. Match against saved projects (Local-First Priority)
  for (const project of projects) {
    const localValid = Boolean(project.localPath && fs.existsSync(project.localPath))
    const projectUrl = localValid ? project.localPath : project.httpsUrl

    // Direct ID, Name, or Local Hash match (e.g. l_projectId)
    const localHash = `l_${project.id}`.toLowerCase()
    const nameHash = `l_${projectId(project.name)}`.toLowerCase()
    const pathHash = project.localPath ? `l_${projectId(project.localPath)}`.toLowerCase() : ''
    if (project.id.toLowerCase() === key || localHash === key || nameHash === key || pathHash === key || project.name.toLowerCase() === key) {
      return {
        parsed,
        resolved: {
          repoPathOrUrl: projectUrl,
          name: project.name,
          source: localValid ? 'local' : 'remote',
          persistence: 'saved',
          project,
        },
      }
    }

    // Remote Identity Fingerprint match (r_{hash}) or URL match
    if (project.httpsUrl) {
      const identity = normalizeRemote(project.httpsUrl)
      if (identity) {
        const hashKey = `r_${projectId(identity.key)}`
        if (hashKey === key || identity.key.toLowerCase() === key) {
          return {
            parsed,
            resolved: {
              repoPathOrUrl: projectUrl,
              name: project.name,
              source: localValid ? 'local' : 'remote',
              persistence: 'saved',
              project,
            },
          }
        }

        // Direct remote path match: owner/repo
        if (parsed.owner && parsed.repo) {
          if (identity.name.toLowerCase() === parsed.repo.toLowerCase() && identity.key.toLowerCase().includes(parsed.owner.toLowerCase())) {
            return {
              parsed,
              resolved: {
                repoPathOrUrl: projectUrl,
                name: project.name,
                source: localValid ? 'local' : 'remote',
                persistence: 'saved',
                project,
              },
            }
          }
        }
      }
    }
  }

  // 2. Not found in saved projects -> check if public GitHub repository (Temporary mode)
  let candidateRemote = parsed.remoteUrl
  if (!candidateRemote) {
    if (parsed.owner && parsed.repo) {
      candidateRemote = `https://github.com/${parsed.owner}/${parsed.repo}`
    } else if (key.startsWith('github/')) {
      candidateRemote = `https://github.com/${key.replace(/^github\//, '')}`
    } else if (parseGitHubRepo(key)) {
      candidateRemote = key.startsWith('http') ? key : `https://github.com/${key}`
    }
  }

  if (candidateRemote && parseGitHubRepo(candidateRemote)) {
    const gh = parseGitHubRepo(candidateRemote)
    const repoName = gh ? `${gh.owner}/${gh.repo}` : candidateRemote
    return {
      parsed,
      resolved: {
        repoPathOrUrl: candidateRemote,
        name: repoName,
        source: 'remote',
        persistence: 'temporary',
      },
    }
  }

  // 3. Not found locally and cannot be loaded as public GitHub repo -> Unresolved Remote
  return {
    parsed,
    resolved: {
      repoPathOrUrl: '',
      name: parsed.repo || parsed.repoKey,
      source: 'local',
      persistence: 'temporary',
      error: 'UNRESOLVED_REMOTE',
      unresolvedIdentity: {
        key: parsed.repoKey,
        remoteUrl: parsed.remoteUrl || `https://${parsed.repoKey}.git`,
        name: parsed.repo || parsed.repoKey.split('/').pop() || parsed.repoKey,
        commitHash: parsed.resourceType === 'commit' ? parsed.resourceId : undefined,
      },
    },
  }
}
