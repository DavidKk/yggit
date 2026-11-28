import fs from 'node:fs'
import path from 'node:path'

import { parseGitBranches, parseGitRemotes, parseGitWorktrees } from '@/lib/git/parse'
import type { GitLogView } from '@/lib/git/types'

import { git, gitOptional, readHead, readLogPage, readWorktree, resolveGitRepo } from './read'
import { parseGitHubRepo, readRemoteGitLog } from './remote-provider'

export interface WorkdeskProbeResult {
  unchanged: boolean
  signature: string
  logView?: GitLogView
}

function statSignature(targetPath: string, label: string): string {
  try {
    const stat = fs.statSync(targetPath)
    return `${label}:${stat.mtimeMs}:${stat.size}`
  } catch {
    return `${label}:0`
  }
}

function resolveGitDirSync(repoRoot: string): string | null {
  const dotGit = path.join(repoRoot, '.git')
  try {
    const stat = fs.statSync(dotGit)
    if (stat.isDirectory()) return dotGit
    if (stat.isFile()) {
      const content = fs.readFileSync(dotGit, 'utf8')
      const match = content.match(/^gitdir:\s*(.+)$/im)
      if (match?.[1]) {
        return path.resolve(repoRoot, match[1].trim())
      }
    }
  } catch {
    // Ignore missing .git
  }
  return null
}

function resolveCommonGitDirSync(gitDir: string): string {
  try {
    const commonFile = path.join(gitDir, 'commondir')
    if (fs.existsSync(commonFile)) {
      const rel = fs.readFileSync(commonFile, 'utf8').trim()
      if (rel) return path.resolve(gitDir, rel)
    }
  } catch {
    // Fallback to gitDir
  }
  return gitDir
}

/**
 * Computes a fast `< 1ms` metadata signature from `.git/HEAD`, `.git/index`,
 * refs, and packed-refs so unchanged repositories skip spawning git subprocesses.
 */
export function computeLocalRepoSignature(repoRoot: string): string {
  const gitDir = resolveGitDirSync(repoRoot)
  if (!gitDir) return `missing:${Date.now()}`

  const commonDir = resolveCommonGitDirSync(gitDir)
  const targets: Array<[string, string]> = [
    [path.join(gitDir, 'HEAD'), 'HEAD'],
    [path.join(gitDir, 'index'), 'index'],
    [path.join(gitDir, 'FETCH_HEAD'), 'FETCH_HEAD'],
    [path.join(gitDir, 'MERGE_HEAD'), 'MERGE_HEAD'],
    [path.join(gitDir, 'REBASE_HEAD'), 'REBASE_HEAD'],
    [path.join(commonDir, 'packed-refs'), 'packed-refs'],
    [path.join(commonDir, 'refs', 'heads'), 'refs/heads'],
    [path.join(commonDir, 'refs', 'remotes'), 'refs/remotes'],
  ]

  return targets.map(([target, label]) => statSignature(target, label)).join('|')
}

/**
 * Lightweight probe used by background Workdesk checks in Local mode.
 * Returns `{ unchanged: true }` immediately when the repository metadata signature
 * matches `knownSignature`, and otherwise queries only the fields needed by detectors
 * (skipping tags, stashes, submodules, and full 300-commit history walks).
 */
export async function probeLocalRepoForWorkdesk(input: { repo: string; knownSignature?: string; force?: boolean }): Promise<WorkdeskProbeResult> {
  const rawRepo = input.repo.trim()
  if (rawRepo && parseGitHubRepo(rawRepo)) {
    const logView = await readRemoteGitLog(rawRepo)
    const signature = `remote:${logView.branches.map((b) => `${b.name}:${b.tip}`).join(',')}`
    if (!input.force && input.knownSignature && input.knownSignature === signature) {
      return { unchanged: true, signature }
    }
    return { unchanged: false, signature, logView }
  }

  const repo = await resolveGitRepo(rawRepo)
  const signature = computeLocalRepoSignature(repo)
  if (!input.force && input.knownSignature && signature === input.knownSignature) {
    return { unchanged: true, signature }
  }

  const [head, branchText, remoteText, worktreeText, status, page] = await Promise.all([
    readHead(repo),
    git(repo, ['for-each-ref', 'refs/heads', '--format=%(refname:short)%00%(upstream:short)%00%(HEAD)%00%(objectname)%00%(upstream:track,nobracket)']),
    gitOptional(repo, ['for-each-ref', 'refs/remotes', '--format=%(refname:short)%00%(objectname)']),
    gitOptional(repo, ['worktree', 'list', '--porcelain']),
    readWorktree(repo),
    readLogPage(repo, '*', 0, 15).catch(() => ({ commits: [], hasMore: false })),
  ])

  const branches = parseGitBranches(branchText)
  if (head && !branches.some((item) => item.name === head)) {
    branches.unshift({ name: head, upstream: '', current: true, tip: '' })
  }
  const worktrees = parseGitWorktrees(worktreeText).map((entry) => ({ ...entry, current: entry.path === repo }))

  const logView: GitLogView = {
    repo,
    displayPath: repo,
    head,
    branch: head,
    branches,
    remotes: parseGitRemotes(remoteText),
    tags: [],
    stashes: [],
    worktrees,
    submodules: [],
    commits: page.commits,
    hasMore: page.hasMore,
    marks: {},
    worktree: status,
  }

  // Re-read metadata signature after git status/diff so index racy-git refreshes are included.
  const finalSignature = computeLocalRepoSignature(repo)

  return {
    unchanged: false,
    signature: finalSignature,
    logView,
  }
}
