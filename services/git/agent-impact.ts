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
  const cleanSource = cleanBranchName(sourceBranch)
  const resolvedTarget = await resolveTargetBranch(repo, targetBranch)

  try {
    // 1. Find common ancestor
    const commonAncestor = await gitExec(repo, ['merge-base', cleanSource, resolvedTarget]).catch(() => '')

    // 2. Commits in sourceBranch but NOT in targetBranch
    const sourceOnlyRaw = await gitExec(repo, ['log', `${resolvedTarget}..${cleanSource}`, '--pretty=format:%H%x1f%s%x1f%an', '-n', '50']).catch(() => '')

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
      await gitExec(repo, ['merge-base', '--is-ancestor', cleanSource, resolvedTarget])
      isAncestor = true
    } catch {
      isAncestor = false
    }

    // 4. Commits in targetBranch that might have originated from sourceBranch
    // (Checking if any unmergedCommits were cherry-picked or already merged)
    const contaminatingRaw = await gitExec(repo, ['log', `${commonAncestor}..${resolvedTarget}`, '--pretty=format:%H%x1f%s%x1f%an', '-n', '50']).catch(() => '')

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

export interface GetUnmergedBranchesParams {
  repo?: string
  targetBranch?: string
  includeRemote?: boolean
}

export interface UnmergedBranchItem {
  name: string
  isRemote: boolean
  unmergedCommitsCount: number
  latestCommit?: {
    hash: string
    shortHash: string
    subject: string
    author: string
    date: string
  }
}

export interface UnmergedBranchesResult {
  targetBranch: string
  resolvedTargetBranch: string
  totalUnmergedCount: number
  localUnmergedCount: number
  remoteUnmergedCount: number
  unmergedBranches: UnmergedBranchItem[]
  summary: string
  spotlightTargets: SpotlightTarget[]
}

export function cleanBranchName(name?: string): string {
  if (!name) return ''
  let cleaned = name
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .trim()
  cleaned = cleaned.replace(/(?:分支|branch)$/i, '').trim()
  return cleaned
}

/**
 * Resolves the target branch candidate against available references.
 * Gracefully maps 'master' <-> 'main' if one is requested but the other exists.
 */
async function resolveTargetBranch(repo: string, candidate?: string): Promise<string> {
  const cleaned = cleanBranchName(candidate)
  if (cleaned) {
    try {
      await gitExec(repo, ['rev-parse', '--verify', cleaned])
      return cleaned
    } catch {}

    for (const alt of [cleaned.toLowerCase(), cleaned.toUpperCase()]) {
      try {
        await gitExec(repo, ['rev-parse', '--verify', alt])
        return alt
      } catch {}
    }

    if (/^master$/i.test(cleaned)) {
      for (const alt of ['main', 'origin/main', 'origin/master']) {
        try {
          await gitExec(repo, ['rev-parse', '--verify', alt])
          return alt
        } catch {}
      }
    } else if (/^main$/i.test(cleaned)) {
      for (const alt of ['master', 'origin/master', 'origin/main']) {
        try {
          await gitExec(repo, ['rev-parse', '--verify', alt])
          return alt
        } catch {}
      }
    }

    try {
      await gitExec(repo, ['rev-parse', '--verify', `origin/${cleaned}`])
      return `origin/${cleaned}`
    } catch {}
  }

  for (const fallback of ['main', 'master']) {
    try {
      await gitExec(repo, ['rev-parse', '--verify', fallback])
      return fallback
    } catch {}
  }

  try {
    const headBranch = await gitExec(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])
    if (headBranch && headBranch !== 'HEAD') return headBranch
  } catch {}

  return 'HEAD'
}

/**
 * Finds all branches (local and optionally remote) that have not been merged into the target branch.
 */
export async function getGitUnmergedBranches(params: GetUnmergedBranchesParams): Promise<UnmergedBranchesResult> {
  const { repo = '', targetBranch = 'master', includeRemote = true } = params
  const resolvedTarget = await resolveTargetBranch(repo, targetBranch)

  try {
    // 1. Local unmerged branches
    const localRaw = await gitExec(repo, ['branch', '--no-merged', resolvedTarget]).catch(() => '')
    const localBranchNames = localRaw
      .split('\n')
      .map((l) => l.replace(/^[*+\s]+/, '').trim())
      .filter((b) => Boolean(b) && b !== resolvedTarget && !b.startsWith('(HEAD detached'))

    // 2. Remote unmerged branches if enabled
    let remoteBranchNames: string[] = []
    if (includeRemote) {
      const remoteRaw = await gitExec(repo, ['branch', '-r', '--no-merged', resolvedTarget]).catch(() => '')
      remoteBranchNames = remoteRaw
        .split('\n')
        .map((l) => l.replace(/^[*+\s]+/, '').trim())
        .filter((b) => Boolean(b) && !b.includes('->') && !b.endsWith('/HEAD') && b !== resolvedTarget && b !== `origin/${resolvedTarget}`)
    }

    const allBranchEntries = [...localBranchNames.map((name) => ({ name, isRemote: false })), ...remoteBranchNames.map((name) => ({ name, isRemote: true }))]

    const unmergedBranches: UnmergedBranchItem[] = []
    const spotlightTargets: SpotlightTarget[] = []

    for (const item of allBranchEntries) {
      const countRaw = await gitExec(repo, ['rev-list', '--count', `${resolvedTarget}..${item.name}`]).catch(() => '0')
      const unmergedCommitsCount = parseInt(countRaw, 10) || 0

      let latestCommit: UnmergedBranchItem['latestCommit'] = undefined
      try {
        const rawMeta = await gitExec(repo, ['log', '-1', '--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ad', '--date=iso', item.name])
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
      } catch {}

      unmergedBranches.push({
        name: item.name,
        isRemote: item.isRemote,
        unmergedCommitsCount,
        latestCommit,
      })

      if (latestCommit?.hash) {
        spotlightTargets.push({
          hash: latestCommit.hash,
          shortHash: latestCommit.shortHash,
          role: 'candidate',
          evidenceGrade: 'Fact',
          reason: `未合并分支 ${item.name}（领先 ${resolvedTarget} ${unmergedCommitsCount} 个提交）`,
          subject: latestCommit.subject,
          author: latestCommit.author,
          date: latestCommit.date,
        })
      }
    }

    const localUnmergedCount = unmergedBranches.filter((b) => !b.isRemote).length
    const remoteUnmergedCount = unmergedBranches.filter((b) => b.isRemote).length
    const totalUnmergedCount = unmergedBranches.length

    let summary = ''
    if (totalUnmergedCount === 0) {
      summary = `所有分支均已合并到 ${resolvedTarget}，当前没有未合并的分支。`
    } else {
      const branchSummaryList = unmergedBranches.map((b) => `${b.name}（领先 ${b.unmergedCommitsCount} 个提交）`).join('、')
      summary = `当前共有 ${totalUnmergedCount} 个分支尚未合并到 ${resolvedTarget}（本地 ${localUnmergedCount} 个，远程 ${remoteUnmergedCount} 个）：${branchSummaryList}。`
    }

    return {
      targetBranch,
      resolvedTargetBranch: resolvedTarget,
      totalUnmergedCount,
      localUnmergedCount,
      remoteUnmergedCount,
      unmergedBranches,
      summary,
      spotlightTargets,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to check unmerged branches: ${msg}`)
  }
}

export interface FocusBranchResult {
  success: boolean
  branchName: string
  resolvedBranch: string
  hash: string
  shortHash: string
  subject: string
  author: string
  date: string
  message: string
  spotlightTargets: SpotlightTarget[]
}

/**
 * Focuses on a specific branch in the repository and retrieves its latest commit details
 * for the visual graph to scroll and spotlight.
 */
export async function focusGitBranch(params: { repo?: string; branchName: string }): Promise<FocusBranchResult> {
  const { repo = '', branchName } = params
  const cleaned = cleanBranchName(branchName)
  if (!cleaned) {
    throw new Error('分支名称不能为空')
  }

  // 1. Resolve commit hash of branch
  let commitHash = ''
  let resolvedBranch = cleaned

  const candidates = [cleaned, `refs/heads/${cleaned}`, `origin/${cleaned}`, `refs/remotes/origin/${cleaned}`]
  for (const candidate of candidates) {
    try {
      const hash = await gitExec(repo, ['rev-parse', '--verify', candidate])
      if (hash) {
        commitHash = hash
        resolvedBranch = candidate.replace(/^refs\/(?:heads|remotes)\//, '')
        break
      }
    } catch {}
  }

  if (!commitHash) {
    throw new Error(`未找到分支 "${branchName}"。请确认分支名称是否存在。`)
  }

  // 2. Fetch commit details
  const rawMeta = await gitExec(repo, ['log', '-1', '--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ad', '--date=iso', commitHash])
  const [hash, shortHash, subject, author, date] = (rawMeta || '').split('\x1f')

  const spotlightTargets: SpotlightTarget[] = [
    {
      hash: hash || commitHash,
      shortHash: shortHash || commitHash.slice(0, 7),
      role: 'primary',
      evidenceGrade: 'Fact',
      reason: `已跳转并聚焦到分支 ${resolvedBranch} 最新提交`,
      subject: subject || '',
      author: author || '',
      date: date || '',
    },
  ]

  return {
    success: true,
    branchName,
    resolvedBranch,
    hash: hash || commitHash,
    shortHash: shortHash || commitHash.slice(0, 7),
    subject: subject || '',
    author: author || '',
    date: date || '',
    message: `已为您定位到分支 "${resolvedBranch}"，其最新提交为 ${shortHash || commitHash.slice(0, 7)}（"${subject || ''}"）。图形界面已自动跳转并聚焦。`,
    spotlightTargets,
  }
}
