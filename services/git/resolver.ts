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
}

export function resolveRepoSlug(slugParts: string[]): { parsed: ParsedRepoSlug; resolved: ResolvedRepo } {
  const parsed = parseRepoSlug(slugParts)
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
  const key = parsed.repoKey

  // 1. Match against saved projects
  for (const project of projects) {
    // Direct ID match
    if (project.id === key || `l_${project.id}` === key) {
      const localValid = project.localPath && fs.existsSync(project.localPath)
      return {
        parsed,
        resolved: {
          repoPathOrUrl: localValid ? project.localPath : project.httpsUrl,
          name: project.name,
          source: localValid ? 'local' : 'remote',
          persistence: 'saved',
          project,
        },
      }
    }

    // Remote fingerprint hash match (r_{hash})
    if (project.httpsUrl) {
      const identity = normalizeRemote(project.httpsUrl)
      if (identity) {
        const hashKey = `r_${projectId(identity.key)}`
        if (hashKey === key) {
          const localValid = project.localPath && fs.existsSync(project.localPath)
          return {
            parsed,
            resolved: {
              repoPathOrUrl: localValid ? project.localPath : project.httpsUrl,
              name: project.name,
              source: localValid ? 'local' : 'remote',
              persistence: 'saved',
              project,
            },
          }
        }
      }
    }

    // Direct remote path match: github/owner/repo or github.com/owner/repo
    if (parsed.owner && parsed.repo && project.httpsUrl) {
      const identity = normalizeRemote(project.httpsUrl)
      if (identity && identity.name.toLowerCase() === parsed.repo.toLowerCase() && identity.key.toLowerCase().includes(parsed.owner.toLowerCase())) {
        const localValid = project.localPath && fs.existsSync(project.localPath)
        return {
          parsed,
          resolved: {
            repoPathOrUrl: localValid ? project.localPath : project.httpsUrl,
            name: project.name,
            source: localValid ? 'local' : 'remote',
            persistence: 'saved',
            project,
          },
        }
      }
    }
  }

  // 2. Not found in saved projects -> resolve as public remote repository (Temporary mode)
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

  if (candidateRemote) {
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

  return {
    parsed,
    resolved: {
      repoPathOrUrl: '',
      name: key,
      source: 'local',
      persistence: 'temporary',
      error: `未找到匹配的仓库: ${key}`,
    },
  }
}
