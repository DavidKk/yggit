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
