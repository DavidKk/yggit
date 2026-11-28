import git from 'isomorphic-git'

import { GIT_LOG_PAGE_SIZE } from '@/lib/git/identity'
import type { GitCommit, GitLogView, GitWorktree, GitWorktreeEntry } from '@/lib/git/types'
import { parseGitHubRepo, readRemoteGitLog } from '@/services/git/remote-provider'

import { type EdgeRefsSnapshot, readEdgeRefsSnapshot } from './edge-git-refs'
import { MultiBranchLogSession, type RawCommitItem } from './edge-log-walker'
import type { EdgeRepositoryReader } from './edge-repository-reader'
import type { ReadLogOptions } from './types'

function collectAllRefTips(headOid: string, refs: EdgeRefsSnapshot): string[] {
  const allTips = new Set<string>()
  if (headOid) allTips.add(headOid)
  for (const b of refs.branches) if (b.tip) allTips.add(b.tip)
  for (const r of refs.remotes) if (r.tip) allTips.add(r.tip)
  for (const t of refs.tags) if (t.tip) allTips.add(t.tip)
  return Array.from(allTips)
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : new Error('Aborted')
  }
}

/**
 * Fallback parser for reading worktrees from the on-disk .git/worktrees metadata
 */
export async function readClientWorktrees(fs: ReturnType<typeof import('./handle-fs').createDirectoryHandleFs>): Promise<GitWorktreeEntry[]> {
  try {
    const entries = (await fs.promises.readdir('/.git/worktrees').catch(() => [])) as string[]
    const worktrees: GitWorktreeEntry[] = []
    for (const entry of entries) {
      if (!entry || entry.startsWith('.')) continue
      try {
        const gitdir = ((await fs.promises.readFile(`/.git/worktrees/${entry}/gitdir`, 'utf8').catch(() => '')) as string).trim()
        const head = ((await fs.promises.readFile(`/.git/worktrees/${entry}/HEAD`, 'utf8').catch(() => '')) as string).trim()
        const branch = head.replace(/^ref:\s*refs\/heads\//, '')
        const path = gitdir.replace(/\/\.git$/, '') || entry
        worktrees.push({
          path,
          head,
          branch,
          current: false,
        })
      } catch {
        // ignore individual worktree read error
      }
    }
    return worktrees
  } catch {
    return []
  }
}

/**
 * Standalone browser client log reader when local companion backend is not reachable.
 * Uses Web File System Access handle-fs and isomorphic-git.
 */
export async function readClientLogFallback(reader: EdgeRepositoryReader, options: ReadLogOptions, repo: string): Promise<GitLogView> {
  const { branch, ref, signal } = options
  throwIfAborted(signal)
  const gh = parseGitHubRepo(repo)
  if (gh) {
    options.onProgress?.('Fetching remote Git repository history...')
    return await readRemoteGitLog(repo, branch || ref, options.skip)
  }

  const { handle, fs, cache } = reader
  const isIncrementalRequest = Boolean(options.locate) || (options.skip ?? 0) > 0
  const cachedCtx = isIncrementalRequest ? reader.getCachedLogContext() : undefined

  let refsSnapshot: EdgeRefsSnapshot
  let stashes: GitLogView['stashes'] = []
  let worktrees: GitWorktreeEntry[] = []
  let tipsSignature: string

  if (cachedCtx) {
    refsSnapshot = cachedCtx.refs
    stashes = cachedCtx.stashes
    worktrees = cachedCtx.worktrees
    tipsSignature = cachedCtx.tipsSignature
  } else {
    // Check and request permission if needed
    let perm = typeof handle.queryPermission === 'function' ? await handle.queryPermission({ mode: 'read' }) : 'granted'
    if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
      try {
        perm = await handle.requestPermission({ mode: 'read' })
      } catch {
        // ignore user gesture rejection
      }
    }
    if (perm !== 'granted') {
      throw new Error(`PERMISSION_REQUIRED: Read permission needed for directory "${handle.name}".`)
    }

    // Verify that this is a git directory
    try {
      await fs.promises.stat('/.git')
    } catch {
      throw new Error(`NOT_A_GIT_REPO: Directory "${handle.name}" does not contain a .git folder.`)
    }

    throwIfAborted(signal)
    options.onProgress?.('Parsing branches and refs...')
    refsSnapshot = await readEdgeRefsSnapshot(reader)
    throwIfAborted(signal)

    // Stashes
    try {
      const stashLog = (await fs.promises.readFile('/.git/logs/refs/stash', 'utf8').catch(() => '')) as string
      if (stashLog) {
        const lines = stashLog.trim().split('\n').filter(Boolean)
        stashes = (
          await Promise.all(
            lines.map(async (line, idx) => {
              const [header, ...rest] = line.split('\t')
              const subject = rest.join('\t')
              const parts = header.trim().split(' ')
              const hash = parts[1] || ''
              const timestamp = parts[parts.length - 2]
              const date = timestamp ? new Date(parseInt(timestamp, 10) * 1000).toISOString() : new Date().toISOString()
              const reverseIndex = lines.length - 1 - idx
              let base = ''
              if (hash) {
                try {
                  const c = await git.readCommit({ fs, cache, dir: '/', oid: hash })
                  base = c.commit.parent?.[0] || ''
                } catch {
                  // ignore
                }
              }
              return {
                name: `stash@{${reverseIndex}}`,
                hash,
                base,
                date,
                subject: subject || `WIP on ${refsSnapshot.currentBranch}`,
              }
            })
          )
        ).reverse()
      }
    } catch {
      stashes = []
    }

    // Worktrees
    worktrees = await readClientWorktrees(fs)

    const allTips = collectAllRefTips(refsSnapshot.headOid, refsSnapshot)
    tipsSignature = [...allTips].sort().join(',')
    reader.setCachedLogContext({
      refs: refsSnapshot,
      stashes,
      worktrees,
      tipsSignature,
    })
  }

  const { currentBranch, headOid, branches, tags, remotes, remoteSources, remoteUrl } = refsSnapshot

  // Commits
  options.onProgress?.('Reading Git commits and graph...')
  const isAllRefs = !branch && (!ref || ref === '*' || ref === '')
  const targetRef = branch || ref || currentBranch || 'HEAD'
  let commits: GitCommit[] = []
  let hasMore = false
  let hasPrev = false
  let startIndex = Math.max(0, Math.floor(options.skip || 0))
  let locatedIdx = -1
  const take = Math.max(1, Math.floor(options.take || GIT_LOG_PAGE_SIZE))
  try {
    let rawCommits: RawCommitItem[] = []
    if (isAllRefs) {
      const allTips = collectAllRefTips(headOid, refsSnapshot)
      const sessionKey = `*:${tipsSignature}`
      let session = reader.getLogSession(sessionKey)
      if (!session) {
        session = new MultiBranchLogSession({
          fs,
          cache,
          dir: '/',
          tips: allTips,
        })
        reader.setLogSession(sessionKey, session)
      }

      if (options.locate) {
        const half = Math.floor(take / 2)
        const located = await session.locate(options.locate, take - half + 1, 20000, signal)
        rawCommits = located.commits
        locatedIdx = located.locatedIndex
        if (locatedIdx >= 0) {
          startIndex = Math.max(0, locatedIdx - half)
          await session.ensureCount(startIndex + take + 1, signal)
        }
      } else {
        rawCommits = await session.ensureCount(startIndex + take + 1, signal)
      }
    } else {
      throwIfAborted(signal)
      rawCommits = (await git.log({
        fs,
        cache,
        dir: '/',
        ref: targetRef,
        depth: options.locate ? 5000 : startIndex + take + 1,
      })) as RawCommitItem[]

      if (options.locate) {
        const clean = options.locate.trim().toLowerCase()
        locatedIdx = rawCommits.findIndex((c) => c.oid.toLowerCase() === clean || (clean.length >= 7 && c.oid.toLowerCase().startsWith(clean)))
        if (locatedIdx >= 0) {
          const half = Math.floor(take / 2)
          startIndex = Math.max(0, locatedIdx - half)
        }
      }
    }

    throwIfAborted(signal)

    const branchTips = new Map<string, string[]>()
    for (const b of branches) {
      if (b.tip) {
        const list = branchTips.get(b.tip) || []
        list.push(b.current && b.tip === headOid ? `HEAD -> ${b.name}` : b.name)
        branchTips.set(b.tip, list)
      }
    }
    if (headOid && !branchTips.get(headOid)?.some((name) => name.startsWith('HEAD -> '))) {
      branchTips.set(headOid, [...(branchTips.get(headOid) || []), 'HEAD'])
    }
    for (const t of tags) {
      if (t.tip) {
        const list = branchTips.get(t.tip) || []
        list.push(`tag: ${t.name}`)
        branchTips.set(t.tip, list)
      }
    }
    for (const r of remotes) {
      if (r.tip) {
        const list = branchTips.get(r.tip) || []
        if (!list.includes(r.name)) {
          list.push(r.name)
          branchTips.set(r.tip, list)
        }
      }
    }

    hasMore = rawCommits.length > startIndex + take
    hasPrev = startIndex > 0
    commits = rawCommits.slice(startIndex, startIndex + take).map((item) => {
      const oid = item.oid
      const c = item.commit
      const refs = branchTips.get(oid) || []
      return {
        hash: oid,
        short: oid.slice(0, 7),
        parents: c.parent || [],
        author: c.author?.name || 'Unknown',
        date: c.author?.timestamp ? new Date(c.author.timestamp * 1000).toISOString() : new Date().toISOString(),
        subject: (c.message || '').split('\n')[0] || '',
        body: c.message || '',
        refs,
      }
    })
  } catch (error) {
    if (signal?.aborted) throw error
    const resolvedRef = targetRef === '*' ? currentBranch : targetRef
    if (resolvedRef !== currentBranch || branches.some((item) => item.tip)) throw error
  }

  let worktreeStatus: GitWorktree | null = null
  if (isIncrementalRequest && reader.getLastWorktreeStatus() !== undefined) {
    worktreeStatus = reader.getLastWorktreeStatus() ?? null
  } else {
    options.onProgress?.('Checking workspace status...')
    let worktreeTimer: ReturnType<typeof setTimeout> | undefined
    try {
      const WORKTREE_TIMEOUT = Symbol('worktree-timeout')
      const result = await Promise.race([
        reader.readWorktreeStatus(),
        new Promise<typeof WORKTREE_TIMEOUT>((resolve) => {
          worktreeTimer = setTimeout(() => resolve(WORKTREE_TIMEOUT), 15000)
        }),
      ])
      worktreeStatus = result === WORKTREE_TIMEOUT ? (reader.getLastWorktreeStatus() ?? null) : result
    } catch {
      worktreeStatus = reader.getLastWorktreeStatus() ?? null
    } finally {
      if (worktreeTimer) clearTimeout(worktreeTimer)
    }
  }

  options.onProgress?.('Preparing graph view...')

  return {
    repo,
    remoteUrl,
    displayPath: handle.name,
    head: currentBranch,
    branch: currentBranch,
    branches,
    remotes,
    remoteSources,
    tags,
    stashes,
    worktrees,
    submodules: [],
    commits,
    hasMore,
    hasPrev,
    startIndex,
    locatedIndex: locatedIdx >= 0 ? locatedIdx : undefined,
    marks: {},
    worktree: worktreeStatus,
  }
}
