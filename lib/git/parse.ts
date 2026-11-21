import type { GitBranch, GitCommit, GitRemoteBranch, GitStash, GitSubmodule, GitTag, GitWorktreeEntry } from '@/lib/git/types'

const FIELD = '\x1f'
const RECORD = '\x1e'

/** `git log --pretty=format:%H%x1f%h%x1f%P%x1f%an%x1f%ad%x1f%D%x1f%s%x1e` */
export function parseGitLog(raw: string): GitCommit[] {
  return raw
    .split(RECORD)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [hash = '', short = '', parents = '', author = '', date = '', decorations = '', subject = ''] = row.split(FIELD)
      return {
        hash,
        short,
        parents: parents.split(' ').filter(Boolean),
        author,
        date,
        refs: decorations
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        subject,
      }
    })
    .filter((commit) => commit.hash.length > 0)
}

/** `git for-each-ref --format=%(refname:short)%00%(upstream:short)%00%(HEAD)%00%(objectname)%00%(upstream:track,nobracket)` */
export function parseGitBranches(raw: string): GitBranch[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', upstream = '', head = '', tip = '', track = ''] = line.split('\0')
      let ahead: number | undefined
      let behind: number | undefined
      let gone: boolean | undefined
      if (track) {
        const aheadMatch = track.match(/ahead (\d+)/)
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10)
        const behindMatch = track.match(/behind (\d+)/)
        if (behindMatch) behind = parseInt(behindMatch[1], 10)
        if (track.includes('gone')) gone = true
      }
      return {
        name,
        upstream,
        current: head === '*',
        tip,
        ahead,
        behind,
        gone,
      }
    })
    .filter((branch) => branch.name.length > 0)
}

/** `git for-each-ref refs/remotes --format=%(refname:short)%00%(objectname)` */
export function parseGitRemotes(raw: string): GitRemoteBranch[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [name = '', tip = ''] = line.split('\0')
      const slash = name.indexOf('/')
      if (slash <= 0) return []
      const remote = name.slice(0, slash)
      const branch = name.slice(slash + 1)
      if (!branch || branch === 'HEAD') return []
      return [{ name, remote, branch, tip }]
    })
}

/** `git for-each-ref refs/tags --format=%(refname:short)%00%(*objectname)%00%(objectname)` */
export function parseGitTags(raw: string): GitTag[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [name = '', peeled = '', objectName = ''] = line.split('\0')
      if (!name) return []
      return [{ name, tip: peeled || objectName }]
    })
}

/** `git stash list --format=%gd%x1f%H%x1f%P%x1f%cI%x1f%s` */
export function parseGitStashes(raw: string): GitStash[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [name = '', hash = '', parents = '', date = '', subject = ''] = line.split(FIELD)
      if (!name) return []
      const base = parents.trim().split(/\s+/).filter(Boolean)[0] || ''
      return [{ name, hash, base, date, subject }]
    })
}

/** `git worktree list --porcelain` */
export function parseGitWorktrees(raw: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = []
  let current: GitWorktreeEntry | null = null
  const flush = () => {
    if (current?.path) entries.push(current)
    current = null
  }
  for (const line of raw.split('\n')) {
    if (!line) {
      flush()
      continue
    }
    if (line.startsWith('worktree ')) {
      flush()
      current = { path: line.slice('worktree '.length), head: '', branch: '', current: false }
      continue
    }
    if (!current) continue
    if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length)
    else if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length)
      current.branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
    }
  }
  flush()
  return entries
}

/** `git submodule status` */
export function parseGitSubmodules(raw: string, repo: string): GitSubmodule[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^[+\-U ]?([0-9a-f]{7,64})\s+(\S+)(?:\s+\((.*)\))?$/i)
      if (!match) return []
      const hash = match[1]
      const subPath = match[2]
      const describe = match[3] || ''
      const absolute = subPath.startsWith('/') ? subPath : `${repo.replace(/\/$/, '')}/${subPath}`
      return [{ path: subPath, repo: absolute, hash, describe }]
    })
}
