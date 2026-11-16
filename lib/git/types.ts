export type BranchMark = {
  direction: string
  destination: string
}

export type GitBranch = {
  name: string
  upstream: string
  current: boolean
  tip: string
}

export type GitCommit = {
  hash: string
  short: string
  parents: string[]
  author: string
  date: string
  refs: string[]
  subject: string
}

/** Synthetic selection id for the dirty working tree row (`// 工作区`). */
export const GIT_WORKTREE_HASH = 'WORKTREE'

export const GIT_WORKTREE_COMMIT: GitCommit = {
  hash: GIT_WORKTREE_HASH,
  short: 'WT',
  parents: [],
  author: '',
  date: '',
  refs: [],
  subject: '工作区',
}

export type GitWorktree = {
  files: number
  insertions: number
  deletions: number
}

export type GitRemoteBranch = {
  name: string
  remote: string
  branch: string
  tip: string
}

/** Lightweight remote probe (`git ls-remote`) vs local tracking refs — no fetch. */
export type GitRemoteProbe = {
  remote: string
  branch: string
  name: string
  localTip: string
  remoteTip: string
  status: 'ahead' | 'new'
}

export type GitRemoteCheck = {
  checkedAt: string
  remotes: string[]
  updates: GitRemoteProbe[]
  errors: Array<{ remote: string; message: string }>
}

export type GitTag = {
  name: string
  tip: string
}

export type GitStash = {
  name: string
  hash: string
  /** First parent — HEAD at stash time (empty if unknown). */
  base: string
  date: string
  subject: string
}

/** Synthetic commit so stash selection reuses the commit panel. */
export function gitStashAsCommit(stash: GitStash): GitCommit {
  return {
    hash: stash.hash,
    short: stash.hash.slice(0, 7),
    parents: stash.base ? [stash.base] : [],
    author: '',
    date: stash.date,
    refs: [stash.name],
    subject: stash.subject || stash.name,
  }
}

export type GitWorktreeEntry = {
  path: string
  head: string
  branch: string
  current: boolean
}

export type GitSubmodule = {
  path: string
  repo: string
  hash: string
  describe: string
}

export type GitSelection =
  | { kind: 'all' }
  | { kind: 'local'; name: string }
  | { kind: 'remote'; name: string }
  | { kind: 'tag'; name: string }
  | { kind: 'stash'; name: string }
  | { kind: 'worktree'; path: string }

export type GitLogView = {
  repo: string
  displayPath: string
  remoteUrl?: string
  remoteKey?: string
  head: string
  branch: string
  branches: GitBranch[]
  remotes: GitRemoteBranch[]
  tags: GitTag[]
  stashes: GitStash[]
  worktrees: GitWorktreeEntry[]
  submodules: GitSubmodule[]
  commits: GitCommit[]
  hasMore: boolean
  marks: Record<string, BranchMark>
  worktree: GitWorktree | null
}

export type GitFileChange = {
  status: string
  path: string
  oldPath: string
}

export type GitCommitChanges = {
  hash: string
  files: GitFileChange[]
  patch: string
  truncated: boolean
  content?: string
  contentMissing?: boolean
  contentBinary?: boolean
  contentTruncated?: boolean
}

/** Custom folder name in the project switcher (filesystem-style groups). */
export type GitProjectGroup = string

export type GitProjectHost = 'gitlab' | 'github' | 'local'

export type GitRemoteSource = {
  name: string
  url: string
  isPrivate?: boolean
}

export type GitProjectView = {
  id: string
  name: string
  group: GitProjectGroup
  host: GitProjectHost
  localPath: string
  httpsUrl: string
  local: boolean
  remote: boolean
  authorized: boolean
  remotes?: GitRemoteSource[]
}

export type GitProjectCatalog = {
  projects: GitProjectView[]
  folders: string[]
}
