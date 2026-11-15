import type { GitBranch, GitCommit, GitCommitChanges, GitFileChange, GitLogView, GitRemoteBranch } from '@/lib/git/types'

interface GitHubCommitItem {
  sha: string
  commit: {
    author: { name: string; date: string }
    message: string
  }
  parents: Array<{ sha: string }>
}

interface GitHubBranchItem {
  name: string
  commit: { sha: string }
}

const memoryCache = new Map<string, { data: unknown; expires: number }>()

function getCached<T>(key: string): T | null {
  const hit = memoryCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) {
    memoryCache.delete(key)
    return null
  }
  return hit.data as T
}

function setCached<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  memoryCache.set(key, { data, expires: Date.now() + ttlMs })
}

export function parseGitHubRepo(urlOrPath: string): { owner: string; repo: string } | null {
  const trimmed = urlOrPath.trim()
  if (!trimmed) return null

  // Match https://github.com/owner/repo or git@github.com:owner/repo
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git|\/)?$/)
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] }

  const sshMatch = trimmed.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/)
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] }

  // Match shorthand owner/repo
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] }

  // Match fingerprint github.com/owner/repo
  const fpMatch = trimmed.match(/^github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (fpMatch) return { owner: fpMatch[1], repo: fpMatch[2] }

  return null
}

async function fetchGitHubApi<T>(endpoint: string): Promise<T> {
  const cacheKey = `gh:${endpoint}`
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Yggit-Client',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`https://api.github.com${endpoint}`, { headers })
  if (!res.ok) {
    const errorText = await res.text()
    if (res.status === 403 || res.status === 429) {
      throw new Error(`GitHub API rate limit exceeded. Please try again later or add a GITHUB_TOKEN.`)
    }
    throw new Error(`GitHub API error (${res.status}): ${errorText || res.statusText}`)
  }

  const json = (await res.json()) as T
  setCached(cacheKey, json)
  return json
}

export async function readRemoteGitLog(urlOrPath: string, branchName?: string): Promise<GitLogView> {
  const gh = parseGitHubRepo(urlOrPath)
  if (!gh) {
    throw new Error(`Unsupported remote repository URL: ${urlOrPath}`)
  }

  const { owner, repo } = gh
  const repoFullName = `${owner}/${repo}`

  // Fetch branches and repo info in parallel
  const [branchesData, repoInfo] = await Promise.all([
    fetchGitHubApi<GitHubBranchItem[]>(`/repos/${owner}/${repo}/branches?per_page=100`).catch(() => []),
    fetchGitHubApi<{ default_branch?: string }>(`/repos/${owner}/${repo}`).catch(() => ({ default_branch: 'main' })),
  ])

  const defaultBranch = branchName || repoInfo.default_branch || 'main'

  // Fetch commits for target branch
  const commitsData = await fetchGitHubApi<GitHubCommitItem[]>(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=100`).catch(() => [])

  // Map to GitBranch and GitRemoteBranch
  const branches: GitBranch[] = branchesData.map((b) => ({
    name: b.name,
    upstream: `origin/${b.name}`,
    current: b.name === defaultBranch,
    tip: b.commit.sha,
  }))

  const remotes: GitRemoteBranch[] = branchesData.map((b) => ({
    name: `origin/${b.name}`,
    remote: 'origin',
    branch: b.name,
    tip: b.commit.sha,
  }))

  // Map to GitCommit
  const branchTipMap = new Map<string, string[]>()
  for (const b of branchesData) {
    const existing = branchTipMap.get(b.commit.sha) || []
    existing.push(b.name)
    branchTipMap.set(b.commit.sha, existing)
  }

  const commits: GitCommit[] = commitsData.map((c) => {
    const refs: string[] = []
    const matchingBranches = branchTipMap.get(c.sha)
    if (matchingBranches) {
      refs.push(...matchingBranches)
    }
    return {
      hash: c.sha,
      short: c.sha.slice(0, 7),
      parents: c.parents.map((p) => p.sha),
      author: c.commit.author?.name || 'Unknown',
      date: c.commit.author?.date || new Date().toISOString(),
      refs,
      subject: c.commit.message?.split('\n')[0] || '',
    }
  })

  const head = commits[0]?.hash || ''

  return {
    repo: `https://github.com/${repoFullName}`,
    displayPath: repoFullName,
    remoteUrl: `https://github.com/${repoFullName}.git`,
    remoteKey: `github.com/${repoFullName.toLowerCase()}`,
    head,
    branch: defaultBranch,
    branches,
    remotes,
    tags: [],
    stashes: [],
    worktrees: [],
    submodules: [],
    commits,
    hasMore: commits.length >= 100,
    marks: {},
    worktree: null,
  }
}

export async function readRemoteCommitChanges(urlOrPath: string, ref: string): Promise<GitCommitChanges> {
  const gh = parseGitHubRepo(urlOrPath)
  if (!gh) throw new Error(`Unsupported remote URL: ${urlOrPath}`)

  const { owner, repo } = gh
  interface GHCommitDetail {
    files?: Array<{
      filename: string
      status: string
      previous_filename?: string
    }>
  }

  const detail = await fetchGitHubApi<GHCommitDetail>(`/repos/${owner}/${repo}/commits/${ref}`)
  const files: GitFileChange[] = (detail.files || []).map((f) => {
    let status = 'M'
    if (f.status === 'added') status = 'A'
    else if (f.status === 'removed') status = 'D'
    else if (f.status === 'renamed') status = 'R'
    return {
      path: f.filename,
      oldPath: f.previous_filename || '',
      status,
    }
  })

  return {
    hash: ref,
    files,
    patch: '',
    truncated: false,
  }
}

export async function readRemoteBlob(urlOrPath: string, ref: string, filePath: string): Promise<string> {
  const gh = parseGitHubRepo(urlOrPath)
  if (!gh) throw new Error(`Unsupported remote URL: ${urlOrPath}`)

  const { owner, repo } = gh
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`
  const res = await fetch(rawUrl)
  if (!res.ok) throw new Error(`Failed to load blob (${res.status}): ${filePath}`)
  return await res.text()
}
