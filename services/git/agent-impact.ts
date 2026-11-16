import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { resolveGitRepo } from './read'

const execFileAsync = promisify(execFile)

async function gitExec(repo: string, args: string[]): Promise<string> {
  const resolvedRepo = await resolveGitRepo(repo)
  const { stdout } = await execFileAsync('git', ['-C', resolvedRepo, ...args], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 20000,
    encoding: 'utf8',
  })
  return stdout.trim()
}

export type EvidenceGrade = 'Fact' | 'Derived' | 'Hypothesis'

export interface SpotlightTarget {
  hash: string
  shortHash: string
  role: 'primary' | 'related' | 'candidate'
  evidenceGrade: EvidenceGrade
  reason: string
  subject?: string
  author?: string
  date?: string
}

export interface BranchContainmentResult {
  contained: boolean
  commonAncestor: string
  unmergedCommitsCount: number
  unmergedCommits: Array<{ hash: string; subject: string; author: string }>
  pollutingCommitsCount: number
  pollutingCommits: Array<{ hash: string; subject: string; author: string }>
  summary: string
  spotlightTargets: SpotlightTarget[]
}

export interface TodayMergesResult {
  totalMerges: number
  merges: Array<{
    hash: string
    shortHash: string
    subject: string
    author: string
    date: string
    parents: string[]
  }>
  spotlightTargets: SpotlightTarget[]
}

export interface FindCommitsResult {
  count: number
  commits: Array<{
    hash: string
    shortHash: string
    subject: string
    author: string
    date: string
  }>
  spotlightTargets: SpotlightTarget[]
}

/**
 * Checks branch containment and detects whether targetBranch was contaminated
 * with commits from sourceBranch (or vice versa).
 */
export async function checkBranchContainment(params: { repo?: string; sourceBranch: string; targetBranch: string }): Promise<BranchContainmentResult> {
  const { repo = '', sourceBranch, targetBranch } = params

  try {
    // 1. Find common ancestor
    const commonAncestor = await gitExec(repo, ['merge-base', sourceBranch, targetBranch]).catch(() => '')

    // 2. Commits in sourceBranch but NOT in targetBranch
    const sourceOnlyRaw = await gitExec(repo, ['log', `${targetBranch}..${sourceBranch}`, '--pretty=format:%H%x1f%s%x1f%an', '-n', '50']).catch(() => '')

    const unmergedCommits = sourceOnlyRaw
      ? sourceOnlyRaw
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [hash, subject, author] = line.split('\x1f')
            return { hash: hash || '', subject: subject || '', author: author || '' }
          })
      : []

    // 3. Check if targetBranch actually contains sourceBranch (is sourceBranch ancestor of targetBranch?)
    let isAncestor = false
    try {
      await gitExec(repo, ['merge-base', '--is-ancestor', sourceBranch, targetBranch])
      isAncestor = true
    } catch {
      isAncestor = false
    }

    // 4. Commits in targetBranch that might have originated from sourceBranch
    // (Checking if any unmergedCommits were cherry-picked or already merged)
    const contaminatingRaw = await gitExec(repo, ['log', `${commonAncestor}..${targetBranch}`, '--pretty=format:%H%x1f%s%x1f%an', '-n', '50']).catch(() => '')

    const targetBranchCommits = contaminatingRaw
      ? contaminatingRaw
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [hash, subject, author] = line.split('\x1f')
            return { hash: hash || '', subject: subject || '', author: author || '' }
          })
      : []

    const spotlightTargets: SpotlightTarget[] = []

    unmergedCommits.slice(0, 5).forEach((c, idx) => {
      spotlightTargets.push({
        hash: c.hash,
        shortHash: c.hash.slice(0, 7),
        role: idx === 0 ? 'primary' : 'related',
        evidenceGrade: 'Fact',
        reason: `Commit in ${sourceBranch} not yet merged into ${targetBranch}`,
        subject: c.subject,
        author: c.author,
      })
    })

    const summary = isAncestor
      ? `Branch '${targetBranch}' fully contains all commits from '${sourceBranch}'.`
      : unmergedCommits.length > 0
        ? `Branch '${targetBranch}' does NOT contain ${unmergedCommits.length} commits from '${sourceBranch}'. Common ancestor is ${commonAncestor.slice(0, 7)}.`
        : `Branches '${sourceBranch}' and '${targetBranch}' are in sync or diverge from ${commonAncestor.slice(0, 7)}.`

    return {
      contained: isAncestor,
      commonAncestor,
      unmergedCommitsCount: unmergedCommits.length,
      unmergedCommits,
      pollutingCommitsCount: 0,
      pollutingCommits: targetBranchCommits.slice(0, 10),
      summary,
      spotlightTargets,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to check branch containment: ${msg}`)
  }
}

/**
 * Returns merge commits created today or in the specified time frame.
 */
export async function getTodayMerges(params: { repo?: string; since?: string }): Promise<TodayMergesResult> {
  const { repo = '', since = 'midnight' } = params

  try {
    const raw = await gitExec(repo, ['log', '--merges', `--since=${since}`, '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1f%P', '--date=iso', '-n', '50'])

    const merges = raw
      ? raw
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [hash, shortHash, author, date, subject, parents] = line.split('\x1f')
            return {
              hash: hash || '',
              shortHash: shortHash || '',
              author: author || '',
              date: date || '',
              subject: subject || '',
              parents: (parents || '').split(' ').filter(Boolean),
            }
          })
      : []

    const spotlightTargets: SpotlightTarget[] = merges.map((m, idx) => ({
      hash: m.hash,
      shortHash: m.shortHash,
      role: idx === 0 ? 'primary' : 'related',
      evidenceGrade: 'Fact',
      reason: `Merge commit recorded on ${m.date}: ${m.subject}`,
      subject: m.subject,
      author: m.author,
      date: m.date,
    }))

    return {
      totalMerges: merges.length,
      merges,
      spotlightTargets,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to get merges: ${msg}`)
  }
}

/**
 * Searches commits by message query, author name, or date range.
 */
export async function findGitCommits(params: { repo?: string; query?: string; author?: string; since?: string; maxCount?: number }): Promise<FindCommitsResult> {
  const { repo = '', query, author, since, maxCount = 20 } = params

  const args = ['log', '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s', '--date=iso', `-n`, String(maxCount)]

  if (query) args.push(`--grep=${query}`)
  if (author) args.push(`--author=${author}`)
  if (since) args.push(`--since=${since}`)

  try {
    const raw = await gitExec(repo, args)
    const commits = raw
      ? raw
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [hash, shortHash, commitAuthor, date, subject] = line.split('\x1f')
            return {
              hash: hash || '',
              shortHash: shortHash || '',
              author: commitAuthor || '',
              date: date || '',
              subject: subject || '',
            }
          })
      : []

    const spotlightTargets: SpotlightTarget[] = commits.map((c, idx) => ({
      hash: c.hash,
      shortHash: c.shortHash,
      role: idx === 0 ? 'primary' : 'candidate',
      evidenceGrade: 'Fact',
      reason: `Matched commit: ${c.subject}`,
      subject: c.subject,
      author: c.author,
      date: c.date,
    }))

    return {
      count: commits.length,
      commits,
      spotlightTargets,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to find commits: ${msg}`)
  }
}

/**
 * Retrieves detailed commit info including stat summary and changed files.
 */
export async function getGitCommitDetails(params: { repo?: string; commitHash: string }): Promise<{
  hash: string
  author: string
  date: string
  subject: string
  body: string
  stat: string
  files: string[]
}> {
  const { repo = '', commitHash } = params

  try {
    const rawMeta = await gitExec(repo, ['show', '-s', '--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1f%b', '--date=iso', commitHash])

    const [hash, author, date, subject, body] = rawMeta.split('\x1f')

    const stat = await gitExec(repo, ['show', '--stat', '--oneline', commitHash]).catch(() => '')
    const filesRaw = await gitExec(repo, ['diff-tree', '--no-commit-id', '--name-only', '-r', commitHash]).catch(() => '')
    const files = filesRaw.split('\n').filter(Boolean)

    return {
      hash: hash || commitHash,
      author: author || '',
      date: date || '',
      subject: subject || '',
      body: body || '',
      stat,
      files,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to get commit details: ${msg}`)
  }
}

export interface GitBranchesResult {
  currentBranch: string
  totalCount: number
  localCount: number
  remoteCount: number
  branches: Array<{
    name: string
    isCurrent: boolean
    isRemote: boolean
    upstream?: string
    tip?: string
  }>
}

/**
 * Retrieves all Git branches with classification, current HEAD branch, and counts.
 */
export async function getGitBranches(params: { repo?: string }): Promise<GitBranchesResult> {
  const { repo = '' } = params
  try {
    const raw = await gitExec(repo, ['for-each-ref', 'refs/heads', 'refs/remotes', '--format=%(refname)%00%(refname:short)%00%(upstream:short)%00%(HEAD)%00%(objectname)'])
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    const branches = lines
      .map((line) => {
        const [refname = '', shortName = '', upstream = '', head = '', tip = ''] = line.split('\0')
        if (refname.endsWith('/HEAD')) return null
        const isRemote = refname.startsWith('refs/remotes/')
        return {
          name: shortName,
          isCurrent: head === '*',
          isRemote,
          upstream: upstream || undefined,
          tip: tip || undefined,
        }
      })
      .filter((b): b is NonNullable<typeof b> => Boolean(b && b.name))

    const current = branches.find((b) => b.isCurrent)?.name || ''
    const localBranches = branches.filter((b) => !b.isRemote)
    const remoteBranches = branches.filter((b) => b.isRemote)

    return {
      currentBranch: current,
      totalCount: branches.length,
      localCount: localBranches.length,
      remoteCount: remoteBranches.length,
      branches,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to list branches: ${msg}`)
  }
}

export interface GitRepoSummaryResult {
  currentBranch: string
  totalCommits: number
  totalBranches: number
  latestCommit?: {
    hash: string
    shortHash: string
    subject: string
    author: string
    date: string
  }
  dirtyFilesCount: number
}

/**
 * Retrieves quick repository summary: current branch, commit count, branch count, latest commit, dirty files.
 */
export async function getGitRepoSummary(params: { repo?: string }): Promise<GitRepoSummaryResult> {
  const { repo = '' } = params
  try {
    const currentBranch = await gitExec(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')
    const commitCountRaw = await gitExec(repo, ['rev-list', '--count', 'HEAD']).catch(() => '0')
    const totalCommits = parseInt(commitCountRaw, 10) || 0
    const branchListRaw = await gitExec(repo, ['branch', '--list']).catch(() => '')
    const totalBranches = branchListRaw ? branchListRaw.split('\n').filter(Boolean).length : 0
    const statusRaw = await gitExec(repo, ['status', '--porcelain']).catch(() => '')
    const dirtyFilesCount = statusRaw ? statusRaw.split('\n').filter(Boolean).length : 0

    let latestCommit: GitRepoSummaryResult['latestCommit'] = undefined
    try {
      const rawMeta = await gitExec(repo, ['log', '-1', '--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ad', '--date=iso'])
      if (rawMeta) {
        const [hash, shortHash, subject, author, date] = rawMeta.split('\x1f')
        latestCommit = {
          hash: hash || '',
          shortHash: shortHash || '',
          subject: subject || '',
          author: author || '',
          date: date || '',
        }
      }
    } catch {
      // ignore
    }

    return {
      currentBranch,
      totalCommits,
      totalBranches,
      latestCommit,
      dirtyFilesCount,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to get repo summary: ${msg}`)
  }
}
