import git from 'isomorphic-git'

import { GIT_LOG_PAGE_SIZE } from '@/lib/git/identity'
import { isPrivateRemote } from '@/lib/git/project-access'
import type { GitCommit, GitLogView, GitRemoteBranch, GitRemoteSource, GitWorktree, GitWorktreeEntry } from '@/lib/git/types'
import { parseGitHubRepo, readRemoteGitLog } from '@/services/git/remote-provider'

import { computeBranchAheadBehind, type RawCommitItem, walkMultiBranchLog } from './edge-log-walker'
import type { EdgeRepositoryReader } from './edge-repository-reader'
import type { ReadLogOptions } from './types'

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
  const { branch, ref } = options
  const gh = parseGitHubRepo(repo)
  if (gh) {
    options.onProgress?.('Fetching remote Git repository history...')
    return await readRemoteGitLog(repo, branch || ref, options.skip)
  }

  const { handle, fs, cache } = reader

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

  options.onProgress?.('Parsing branches and refs...')

  // 1. Current Branch
  let currentBranch = 'main'
  try {
    currentBranch = (await git.currentBranch({ fs, dir: '/' })) || 'main'
  } catch {
    // Fallback
  }

  // 2. Local Branches
  let branchNames: string[] = []
  try {
    branchNames = await git.listBranches({ fs, dir: '/' })
  } catch {
    branchNames = [currentBranch]
  }
  if (!branchNames.includes(currentBranch)) {
    branchNames.unshift(currentBranch)
  }

  const branches = await Promise.all(
    branchNames.map(async (name) => {
      let tip = ''
      try {
        tip = await git.resolveRef({ fs, dir: '/', ref: name })
      } catch {
        // ignore
      }
      let upstream = ''
      let ahead: number | undefined
      let behind: number | undefined
      try {
        const remoteCfg = await git.getConfig({ fs, dir: '/', path: `branch.${name}.remote` })
        const mergeCfg = await git.getConfig({ fs, dir: '/', path: `branch.${name}.merge` })
        if (remoteCfg && mergeCfg && typeof remoteCfg === 'string' && typeof mergeCfg === 'string') {
          const mergeBranch = mergeCfg.replace(/^refs\/heads\//, '')
          upstream = `${remoteCfg}/${mergeBranch}`
          const remoteTip = await git.resolveRef({ fs, dir: '/', ref: `refs/remotes/${upstream}` }).catch(() => '')
          if (tip && remoteTip) {
            if (tip === remoteTip) {
              ahead = 0
              behind = 0
            } else {
              const counts = await computeBranchAheadBehind(fs, cache, '/', tip, remoteTip)
              if (counts) {
                ahead = counts.ahead
                behind = counts.behind
              }
            }
          }
        }
      } catch {
        // ignore
      }
      return {
        name,
        current: name === currentBranch,
        tip,
        upstream,
        ahead,
        behind,
      }
    })
  )

  // 3. Tags
  let tags: { name: string; tip: string }[] = []
  try {
    const tagNames = await git.listTags({ fs, dir: '/' })
    tags = await Promise.all(
      tagNames.map(async (name) => {
        let tip = ''
        try {
          tip = await git.resolveRef({ fs, dir: '/', ref: name })
        } catch {
          // ignore
        }
        return { name, tip }
      })
    )
  } catch {
    // ignore
  }

  // 4. Remotes & Origin URL
  const remotes: GitRemoteBranch[] = []
  const remoteSources: GitRemoteSource[] = []
  let remoteUrl = ''
  try {
    const rawRemotes = await git.listRemotes({ fs, dir: '/' })
    for (const r of rawRemotes) {
      if (!r.remote) continue
      const bNames = await git.listBranches({ fs, dir: '/', remote: r.remote }).catch(() => [])
      if (!bNames.length && !r.url) continue

      if (r.url && !remoteSources.some((item) => item.name === r.remote)) {
        remoteSources.push({
          name: r.remote,
          url: r.url,
          isPrivate: isPrivateRemote(r.url),
        })
        if (!remoteUrl || r.remote === 'origin') {
          remoteUrl = r.url
        }
      }

      const resolvedTips = await Promise.all(
        bNames.map(async (b) => {
          if (!b || b === 'HEAD') return null
          const tip = await git.resolveRef({ fs, dir: '/', ref: `refs/remotes/${r.remote}/${b}` }).catch(() => '')
          return { name: `${r.remote}/${b}`, remote: r.remote, branch: b, tip }
        })
      )

      for (const item of resolvedTips) {
        if (item && !remotes.some((existing) => existing.name === item.name)) {
          remotes.push(item)
        }
      }
    }

    if (!remoteUrl) {
      const cfgUrl = await git.getConfig({ fs, dir: '/', path: 'remote.origin.url' })
      if (cfgUrl && typeof cfgUrl === 'string') {
        remoteUrl = cfgUrl
      }
    }
  } catch {
    // ignore
  }

  // 4b. Stashes
  let stashes: GitLogView['stashes'] = []
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
              subject: subject || `WIP on ${currentBranch}`,
            }
          })
        )
      ).reverse()
    }
  } catch {
    stashes = []
  }

  // 4c. Worktrees
  const worktrees = await readClientWorktrees(fs)

  // 5. Commits
  options.onProgress?.('Reading Git commits and graph...')
  const headOid = await git.resolveRef({ fs, dir: '/', ref: 'HEAD' }).catch(() => '')
  const isAllRefs = !branch && (!ref || ref === '*' || ref === '')
  const targetRef = branch || ref || currentBranch || 'HEAD'
  let commits: GitCommit[] = []
  let hasMore = false
  let hasPrev = false
  let startIndex = Math.max(0, Math.floor(options.skip || 0))
  const take = Math.max(1, Math.floor(options.take || GIT_LOG_PAGE_SIZE))
  try {
    let rawCommits: RawCommitItem[] = []
    if (isAllRefs) {
      const allTips = new Set<string>()
      if (headOid) allTips.add(headOid)
      for (const b of branches) if (b.tip) allTips.add(b.tip)
      for (const r of remotes) if (r.tip) allTips.add(r.tip)
      for (const t of tags) if (t.tip) allTips.add(t.tip)

      rawCommits = await walkMultiBranchLog({
        fs,
        cache,
        dir: '/',
        tips: Array.from(allTips),
        limit: options.locate ? 5000 : startIndex + take + 1,
        skip: 0,
      })
    } else {
      rawCommits = (await git.log({
        fs,
        cache,
        dir: '/',
        ref: targetRef,
        depth: options.locate ? 5000 : startIndex + take + 1,
      })) as RawCommitItem[]
    }

    if (options.locate) {
      const clean = options.locate.trim().toLowerCase()
      const locatedIdx = rawCommits.findIndex((c) => c.oid.toLowerCase() === clean || (clean.length >= 7 && c.oid.toLowerCase().startsWith(clean)))
      if (locatedIdx >= 0) {
        const half = Math.floor(take / 2)
        startIndex = Math.max(0, locatedIdx - half)
      }
    }

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
    const resolvedRef = targetRef === '*' ? currentBranch : targetRef
    if (resolvedRef !== currentBranch || branches.some((item) => item.tip)) throw error
  }

  options.onProgress?.('Checking workspace status...')
  let worktreeStatus: GitWorktree | null = null
  let worktreeTimer: ReturnType<typeof setTimeout> | undefined
  try {
    worktreeStatus = await Promise.race([
      reader.readWorktreeStatus(),
      new Promise<null>((resolve) => {
        worktreeTimer = setTimeout(() => resolve(null), 1200)
      }),
    ])
  } catch {
    worktreeStatus = null
  } finally {
    if (worktreeTimer) clearTimeout(worktreeTimer)
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
    marks: {},
    worktree: worktreeStatus,
  }
}
