import { GIT_LOG_PAGE_SIZE } from '@/lib/git/identity'
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
    if (res.status === 429 || (res.status === 403 && (res.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(errorText)))) {
      throw new Error(`GitHub API rate limit exceeded. Please try again later or add a GITHUB_TOKEN.`)
    }
    throw new Error(`GitHub API error (${res.status}): ${errorText || res.statusText}`)
  }

  const json = (await res.json()) as T
  setCached(cacheKey, json)
  return json
}

export async function readRemoteGitLog(urlOrPath: string, branchName?: string, skip = 0): Promise<GitLogView> {
  const gh = parseGitHubRepo(urlOrPath)
  if (!gh) {
    throw new Error(`Unsupported remote repository URL: ${urlOrPath}`)
  }

  const { owner, repo } = gh
  const repoFullName = `${owner}/${repo}`

  // Fetch branches and repo info in parallel
  const [branchesData, repoInfo] = await Promise.all([
    fetchGitHubApi<GitHubBranchItem[]>(`/repos/${owner}/${repo}/branches?per_page=100`),
    fetchGitHubApi<{ default_branch?: string }>(`/repos/${owner}/${repo}`),
  ])

  const requestedRef = branchName?.trim()
  const defaultBranch = requestedRef && requestedRef !== '*' ? requestedRef : repoInfo.default_branch || 'main'

  // Read a window with one lookahead commit, including windows crossing API pages.
  const offset = Number.isFinite(skip) ? Math.max(0, Math.floor(skip)) : 0
  let page = Math.floor(offset / 100) + 1
  let pageOffset = offset % 100
  const window: GitHubCommitItem[] = []
  while (window.length <= GIT_LOG_PAGE_SIZE) {
    const batch = await fetchGitHubApi<GitHubCommitItem[]>(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=100&page=${page}`)
    window.push(...batch.slice(pageOffset))
    if (batch.length < 100) break
    pageOffset = 0
    page += 1
  }
  const commitsData = window.slice(0, GIT_LOG_PAGE_SIZE)

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
    hasMore: window.length > GIT_LOG_PAGE_SIZE,
    marks: {},
    worktree: null,
  }
}

export async function readRemoteCommitChanges(urlOrPath: string, ref: string, options: { tree?: boolean; file?: string; all?: boolean } = {}): Promise<GitCommitChanges> {
  const gh = parseGitHubRepo(urlOrPath)
  if (!gh) throw new Error(`Unsupported remote URL: ${urlOrPath}`)

  const base = `/repos/${gh.owner}/${gh.repo}`
  if (options.all) {
    const tree = await fetchGitHubApi<{ tree: Array<{ path: string; type: string }>; truncated: boolean }>(`${base}/git/trees/${encodeURIComponent(ref)}?recursive=1`)
    return {
      hash: ref,
      files: tree.tree.filter((entry) => entry.type === 'blob').map((entry) => ({ path: entry.path, oldPath: '', status: 'M' })),
      patch: '',
      truncated: tree.truncated,
    }
  }

  interface GHCommitDetail {
    files?: Array<{ filename: string; status: string; previous_filename?: string; patch?: string }>
  }
  // Commit file lists are paginated independently of the history API.
  const changed: NonNullable<GHCommitDetail['files']> = []
  let page = 1
  while (true) {
    const detail = await fetchGitHubApi<GHCommitDetail>(`${base}/commits/${encodeURIComponent(ref)}?per_page=100&page=${page}`)
    const batch = detail.files || []
    changed.push(...batch)
    if (batch.length < 100 || page >= 30) break
    page += 1
  }
  const files: GitFileChange[] = changed.map((file) => ({
    path: file.filename,
    oldPath: file.previous_filename || '',
    status: file.status === 'added' ? 'A' : file.status === 'removed' ? 'D' : file.status === 'renamed' ? 'R' : 'M',
  }))
  const selected = options.file ? changed.filter((file) => file.filename === options.file) : changed
  const patch = options.tree
    ? ''
    : selected
        .filter((file) => file.patch)
        .map((file) => {
          // JSON quoting preserves Unicode, spaces, tabs and newlines in Git patch paths.
          const before = JSON.stringify(`a/${file.previous_filename || file.filename}`)
          const after = JSON.stringify(`b/${file.filename}`)
          return `diff --git ${before} ${after}\n--- ${file.status === 'added' ? '/dev/null' : before}\n+++ ${file.status === 'removed' ? '/dev/null' : after}\n${file.patch}\n`
        })
        .join('')
  const result: GitCommitChanges = { hash: ref, files, patch, truncated: changed.length >= 3000 }
  if (options.file && !options.tree) {
    if (selected[0]?.status === 'removed') result.contentMissing = true
    else {
      const blob = await readRemoteBlobData(urlOrPath, ref, options.file)
      result.contentBinary = blob.bytes.slice(0, 8000).includes(0) || /^(image|audio|video)\//.test(blob.contentType)
      result.content = result.contentBinary ? '' : new TextDecoder().decode(blob.bytes)
    }
  }
  return result
}

export async function readRemoteBlobData(urlOrPath: string, ref: string, filePath: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const gh = parseGitHubRepo(urlOrPath)
  if (!gh) throw new Error(`Unsupported remote URL: ${urlOrPath}`)
  const path = filePath.split('/').map(encodeURIComponent).join('/')
  const rawUrl = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${encodeURIComponent(ref)}/${path}`
  const res = await fetch(rawUrl)
  if (!res.ok) throw new Error(`Failed to load blob (${res.status}): ${filePath}`)
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'application/octet-stream' }
}

export async function readRemoteBlob(urlOrPath: string, ref: string, filePath: string): Promise<string> {
  return new TextDecoder().decode((await readRemoteBlobData(urlOrPath, ref, filePath)).bytes)
}
