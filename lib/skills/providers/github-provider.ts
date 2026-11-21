import { parseSkillMarkdown } from '../parser'
import type { SkillDescriptor } from '../types'

export interface GitHubSkillFetchOptions {
  repo: string // e.g. "owner/repo" or "https://github.com/owner/repo"
  branch?: string // defaults to "main"
  directory?: string // subfolder containing SKILL.md, e.g. "skills/code-review"
  token?: string // optional personal access token for private repos
}

/**
 * Normalizes GitHub repository string into owner/repo format.
 */
export function normalizeGitHubRepo(input: string): { owner: string; repo: string } {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
  const parts = cleaned.split('/')
  if (parts.length < 2) {
    throw new Error('Invalid GitHub repository format. Expected "owner/repo" or GitHub URL.')
  }
  return { owner: parts[0], repo: parts[1] }
}

/**
 * Fetches a SKILL.md file from a GitHub repository.
 */
export async function fetchSkillFromGitHub(options: GitHubSkillFetchOptions): Promise<SkillDescriptor> {
  const { owner, repo } = normalizeGitHubRepo(options.repo)
  const branch = options.branch || 'main'
  const dir = options.directory ? options.directory.replace(/^\/+|\/+$/g, '') : ''
  const filePath = dir ? `${dir}/SKILL.md` : 'SKILL.md'

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`

  let rawContent: string
  try {
    // Attempt fast raw URL fetch first
    const res = await fetch(rawUrl, { headers: options.token ? { Authorization: `token ${options.token}` } : {} })
    if (res.ok) {
      rawContent = await res.text()
    } else {
      // Fallback to GitHub API
      const apiRes = await fetch(apiUrl, { headers })
      if (!apiRes.ok) {
        throw new Error(`Failed to fetch SKILL.md from GitHub (HTTP ${apiRes.status}): ${await apiRes.text()}`)
      }
      rawContent = await apiRes.text()
    }
  } catch (err) {
    throw new Error(`Could not access GitHub repository ${owner}/${repo}: ${err instanceof Error ? err.message : String(err)}`)
  }

  const parsed = parseSkillMarkdown(rawContent)
  const id = `gh_${owner}_${repo}_${dir ? dir.replace(/[^a-zA-Z0-9_-]/g, '_') : 'root'}`

  return {
    id,
    name: parsed.name,
    description: parsed.description,
    source: {
      type: 'github',
      uri: `https://github.com/${owner}/${repo}`,
      branch,
      directory: dir || undefined,
    },
    content: rawContent,
    enabled: true,
    trusted: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Discovers all SKILL.md files in a repository or directory using GitHub Git Tree API.
 * Falls back to single file fetch if the Tree API is restricted.
 */
export async function discoverSkillsFromGitHub(options: GitHubSkillFetchOptions): Promise<SkillDescriptor[]> {
  const { owner, repo } = normalizeGitHubRepo(options.repo)
  const branch = options.branch || 'main'
  const prefixDir = options.directory ? options.directory.replace(/^\/+|\/+$/g, '') : ''

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`

  try {
    const treeRes = await fetch(treeUrl, { headers })
    if (treeRes.ok) {
      const data = (await treeRes.json()) as { tree?: Array<{ path: string; type: string }> }
      if (Array.isArray(data.tree)) {
        const skillPaths = data.tree
          .filter((item) => {
            if (item.type !== 'blob') return false
            const isSkillMd = item.path.endsWith('/SKILL.md') || item.path === 'SKILL.md' || item.path.endsWith('/skill.md') || item.path === 'skill.md'
            if (!isSkillMd) return false
            if (prefixDir) {
              return item.path === `${prefixDir}/SKILL.md` || item.path.startsWith(`${prefixDir}/`)
            }
            return true
          })
          .map((item) => item.path)

        if (skillPaths.length > 0) {
          const results: SkillDescriptor[] = []
          for (const path of skillPaths) {
            const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
            try {
              const skill = await fetchSkillFromGitHub({
                repo: options.repo,
                branch,
                directory: dir,
                token: options.token,
              })
              results.push(skill)
            } catch {
              // Ignore single file fetch error in batch discovery
            }
          }
          if (results.length > 0) {
            return results
          }
        }
      }
    }
  } catch {
    // Fallback to single fetch
  }

  // Fallback: fetch single skill
  const single = await fetchSkillFromGitHub(options)
  return [single]
}

/**
 * Checks for updates on a GitHub skill by refetching and comparing content.
 */
export async function checkAndUpdateGitHubSkill(skill: SkillDescriptor, token?: string): Promise<{ hasUpdate: boolean; updatedSkill?: SkillDescriptor }> {
  if (skill.source.type !== 'github') return { hasUpdate: false }

  const repo = skill.source.uri.replace(/^https?:\/\/github\.com\//, '')
  const latest = await fetchSkillFromGitHub({
    repo,
    branch: skill.source.branch,
    directory: skill.source.directory,
    token,
  })

  if (latest.content.trim() !== skill.content.trim()) {
    return {
      hasUpdate: true,
      updatedSkill: {
        ...skill,
        name: latest.name,
        description: latest.description,
        content: latest.content,
        updatedAt: Date.now(),
      },
    }
  }

  return { hasUpdate: false }
}
