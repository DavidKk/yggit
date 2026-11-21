import type { GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectView } from '@/lib/git/types'

export type GitDriverMode = 'edge' | 'local'

export interface ReadLogOptions {
  repo: string
  branch?: string
  ref?: string
  skip?: number
  take?: number
  locate?: string
  onProgress?: (stage: string) => void
}

export interface ReadCommitDiffOptions {
  repo: string
  hash: string
  tree?: boolean
  file?: string
  all?: boolean
}

export interface ReadBlobOptions {
  repo: string
  hash: string
  path: string
}

export interface AddProjectPayload {
  pathOrUrl: string
  name?: string
  group?: string
  handle?: FileSystemDirectoryHandle
}

export interface GitDeleteFolderResult {
  catalog: GitProjectCatalog
  removedCount: number
}

export interface AddRemoteProjectOptions {
  importGroup?: boolean
  provider?: 'github' | 'gitlab'
  url: string
  token?: string
  syncAccount?: boolean
  group?: string
  name?: string
}

export interface GitCheckoutOptions {
  create?: boolean
  startPoint?: string
  track?: boolean
}

export interface GitCommitOptions {
  stageAll?: boolean
  amend?: boolean
  noVerify?: boolean
  pushAfter?: boolean
}

export interface GitPushOptions {
  remote?: string
  branch?: string
  setUpstream?: boolean
  force?: boolean
}

export interface GitPullOptions {
  remote?: string
  branch?: string
  rebase?: boolean
  ffOnly?: boolean
}

export interface GitFetchOptions {
  remote?: string
  all?: boolean
}

export interface GitStashOptions {
  action: 'save' | 'pop' | 'apply' | 'drop'
  message?: string
  index?: number
  paths?: string[]
}

export interface IGitDriver {
  readonly mode: GitDriverMode

  /**
   * Check if this driver is supported and operational in the current environment
   */
  isAvailable(): Promise<boolean>

  /**
   * Read branches, tags, stashes, and commit DAG history
   */
  readLog(options: ReadLogOptions): Promise<GitLogView>

  /**
   * Read commit file diffs / patch / status
   */
  readCommitDiff(options: ReadCommitDiffOptions): Promise<GitCommitChanges>

  /**
   * Read single file blob content at a specific commit hash
   */
  readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }>

  /**
   * Switch or checkout branch
   */
  checkoutBranch(repo: string, branch: string, options?: GitCheckoutOptions): Promise<{ ok: boolean; message: string }>

  /**
   * Create new branch
   */
  createBranch(repo: string, branch: string, startPoint?: string, checkout?: boolean): Promise<{ ok: boolean; message: string }>

  /**
   * Delete local branch
   */
  deleteBranch(repo: string, branch: string, force?: boolean): Promise<{ ok: boolean; message: string }>

  /**
   * Rename branch
   */
  renameBranch(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }>

  /**
   * Merge branch into current branch
   */
  mergeBranch(repo: string, branch: string): Promise<{ ok: boolean; message: string; conflict?: boolean }>

  /**
   * Rebase current branch onto target branch
   */
  rebaseBranch(repo: string, branch: string, options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }>

  /**
   * Cherry-pick commit into current branch
   */
  cherryPick(repo: string, hash: string, options?: { abort?: boolean; continue?: boolean }): Promise<{ ok: boolean; message: string; conflict?: boolean }>

  /**
   * Commit staged or all changes
   */
  commit(repo: string, message: string, options?: boolean | GitCommitOptions): Promise<{ ok: boolean; message: string; hash?: string }>

  /**
   * Undo last commit (git reset --soft HEAD~1)
   */
  undo(repo: string, soft?: boolean): Promise<{ ok: boolean; message: string; undoneHash?: string }>

  /**
   * Redo previously undone commit
   */
  redo(repo: string, soft?: boolean): Promise<{ ok: boolean; message: string }>

  /**
   * Get previous commit summary and description for amend
   */
  getLastCommit(repo: string): Promise<{ summary: string; description: string }>

  /**
   * Create git diff patch
   */
  createPatch(repo: string, options?: { path?: string; staged?: boolean }): Promise<{ patch: string }>

  /**
   * Add entry to .gitignore
   */
  ignorePattern(repo: string, pattern: string): Promise<{ ok: boolean; message: string }>

  /**
   * Create empty file
   */
  createFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }>

  /**
   * Delete file
   */
  deleteFile(repo: string, relativePath: string): Promise<{ ok: boolean; message: string }>

  /**
   * Stage files
   */
  stage(repo: string, files?: string[], all?: boolean): Promise<{ ok: boolean; message: string }>

  /**
   * Unstage files
   */
  unstage(repo: string, files?: string[], all?: boolean): Promise<{ ok: boolean; message: string }>

  /**
   * Discard file changes in working directory
   */
  discard(repo: string, files?: string[], all?: boolean): Promise<{ ok: boolean; message: string }>

  /**
   * Push commits to remote
   */
  push(repo: string, options?: GitPushOptions): Promise<{ ok: boolean; message: string }>

  /**
   * Pull commits from remote
   */
  pull(repo: string, options?: GitPullOptions): Promise<{ ok: boolean; message: string }>

  /**
   * Fetch from remote
   */
  fetch(repo: string, options?: GitFetchOptions): Promise<{ ok: boolean; message: string }>

  /**
   * Stash operations
   */
  stash(repo: string, options: GitStashOptions): Promise<{ ok: boolean; message: string }>

  /**
   * Get list of registered projects
   */
  getProjects(): Promise<GitProjectCatalog>

  /**
   * Register or associate a local handle or remote project
   */
  addProject(payload: AddProjectPayload): Promise<GitProjectView>

  /**
   * Create a new folder in project switcher
   */
  createFolder(name: string): Promise<GitProjectCatalog>

  /**
   * Rename an existing folder in project switcher
   */
  renameFolder(oldName: string, newName: string): Promise<GitProjectCatalog>

  /**
   * Clear all projects out of a folder (moves to ungrouped)
   */
  clearFolder(name: string): Promise<GitProjectCatalog>

  /**
   * Set custom alias/label for a project
   */
  setProjectLabel(id: string, label: string): Promise<GitProjectCatalog>

  /**
   * Delete a folder and remove all projects under it
   */
  deleteFolder(name: string): Promise<GitDeleteFolderResult>

  /**
   * Move project to another folder / reorder
   */
  moveProject(id: string, group: string, beforeId?: string): Promise<GitProjectCatalog>

  /**
   * Remove a single project from catalog
   */
  removeProject(id: string): Promise<GitProjectCatalog>

  /**
   * Add a remote repository by URL
   */
  addRemoteProject(input: AddRemoteProjectOptions): Promise<GitProjectCatalog>

  /**
   * Add a new worktree
   */
  addWorktree?(repo: string, path: string, branch?: string): Promise<{ ok: boolean; message: string }>

  /**
   * Read blame information per line for a file
   */
  readBlame(options: { repo: string; path: string; hash?: string }): Promise<Record<number, GitBlameLine>>
}

export interface GitBlameLine {
  line: number
  hash: string
  author: string
  authorMail: string
  date: string
  summary: string
}
